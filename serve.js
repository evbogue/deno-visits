const html = `
  <script>
    const ws = new WebSocket((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host)
    ws.onopen = e => {ws.send('Hit')}
    ws.onmessage = e => { 
      counter.textContent = (e.data == '1') ? e.data + ' visit.' : e.data + ' visits.'
    }
  </script>
  <pre id='counter'>
`

const sockets = new Set()
const channel = new BroadcastChannel('')

const kv = await Deno.openKv()

const key = ["counter"]

kv.delete(key)

channel.onmessage = async e => {
  console.log(e.data)
  if (e.data === 'Hit') {
    await kv.atomic().mutate({
      type: 'sum',
      key,
      value: new Deno.KvU64(1n)
    }).commit()
  }
  (e.target != channel) && channel.postMessage(e.data)
  const v = await kv.get(key)
  console.log(v)
  const current = v.value.value
  sockets.forEach(s => s.send(current))
  channel.postMessage(current)
}

Deno.serve((r) => {
  try {
    const { socket, response } = Deno.upgradeWebSocket(r)
    sockets.add(socket)
    socket.onmessage = channel.onmessage
    socket.onclose = _ => {
      sockets.delete(socket)
      sockets.forEach(s => s.send(sockets.size))
    }
    return response
  } catch {
    return new Response(html, {headers: {'Content-type': 'text/html'}})
  }
})
