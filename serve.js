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
  (e.target != channel) && channel.postMessage(e.data) 
  const current = await kv.get(key)
  const next = (!current.value) ? 1 : ++current.value
  await kv.set(key, next)
  const check = await kv.get(key)
  sockets.forEach(s => s.send(check.value))
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
