const html = `
  <script>
    const ws = new WebSocket((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host)
    ws.onopen = e => {ws.send('Hello World')}
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

channel.onmessage = async e => {
  await kv.atomic().mutate({
    type: 'sum',
    key,
    value: new Deno.KvU64(1n)
  }).commit()

  const v = await kv.get(key)
  const counter = v.value.value

  channel.postMessage(counter)
  sockets.forEach(s => s.send(counter))
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
