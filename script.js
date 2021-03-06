//import { joinRoom, seldId } from "https://unpkg.com/trystero?module"

const byId = document.getElementById.bind(document)
const canvas = byId('canvas')
const peerInfo = byId('peer-info')
const noPeersCopy = peerInfo.innerText
const config = {appId: 'trystero-94db3'}
const cursors = {}
const roomCap = 33
const fruits = [
  '🍏',
  '🍎',
  '🍐',
  '🍊',
  '🍋',
  '🍌',
  '🍉',
  '🍇',
  '🍓',
  // '🫐',
  '🍈',
  '🍒',
  '🍑',
  '🥭',
  '🍍',
  '🥥',
  '🥝'
]
const randomFruit = () => fruits[Math.floor(Math.random() * fruits.length)]

let mouseX = 0
let mouseY = 0
let room
let sendMove
let sendClick

init(49)
document.documentElement.className = 'ready'
addCursor(selfId, true)

window.addEventListener('mousemove', ({clientX, clientY}) => {
  mouseX = clientX / window.innerWidth
  mouseY = clientY / window.innerHeight
  moveCursor([mouseX, mouseY], selfId)
  if (room) {
    sendMove([mouseX, mouseY])
  }
})

window.addEventListener('click', () => {
  const payload = [randomFruit(), mouseX, mouseY]

  dropFruit(payload)
  if (room) {
    sendClick(payload)
  }
})

window.addEventListener('touchstart', e => {
  const x = e.touches[0].clientX / window.innerWidth
  const y = e.touches[0].clientY / window.innerHeight
  const payload = [randomFruit(), x, y]

  dropFruit(payload)
  moveCursor([x, y], selfId)

  if (room) {
    sendMove([x, y])
    sendClick(payload)
  }
})

async function init(n) {
  const ns = 'room' + n
  const members = (await getOccupants(config, ns)).length

  let getMove
  let getClick

  if (members === roomCap) {
    return init(n + 1)
  }

  room = joinRoom(config, ns)
  ;[sendMove, getMove] = room.makeAction('mouseMove')
  ;[sendClick, getClick] = room.makeAction('click')

  byId('room-num').innerText = 'room #' + n
  room.onPeerJoin(addCursor)
  room.onPeerLeave(removeCursor)
  getMove(moveCursor)
  getClick(dropFruit)
}

function moveCursor([x, y], id) {
  const el = cursors[id]

  if (el) {
    el.style.left = x * window.innerWidth + 'px'
    el.style.top = y * window.innerHeight + 'px'
  }
}

function addCursor(id, isSelf) {
  const el = document.createElement('div')
  const img = document.createElement('img')
  const txt = document.createElement('p')

  el.className = `cursor${isSelf ? ' self' : ''}`
  el.style.left = el.style.top = '-99px'
  img.src = 'images/hand.png'
  txt.innerText = isSelf ? 'you' : id.slice(0, 4)
  el.appendChild(img)
  el.appendChild(txt)
  canvas.appendChild(el)
  cursors[id] = el

  if (!isSelf) {
    updatePeerInfo()
  }

  return el
}

function removeCursor(id) {
  if (cursors[id]) {
    canvas.removeChild(cursors[id])
  }
  updatePeerInfo()
}

function updatePeerInfo() {
  const count = room.getPeers().length
  peerInfo.innerHTML = count
    ? `Right now <em>${count}</em> other peer${
        count === 1 ? ' is' : 's are'
      } connected with you. Send them some fruit.`
    : noPeersCopy
}

function dropFruit([fruit, x, y]) {
  const el = document.createElement('div')
  el.className = 'fruit'
  el.innerText = fruit
  el.style.left = x * window.innerWidth + 'px'
  el.style.top = y * window.innerHeight + 'px'
  canvas.appendChild(el)
  setTimeout(() => canvas.removeChild(el), 3000)
}