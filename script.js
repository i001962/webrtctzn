import { joinRoom, selfId } from "https://cdn.skypack.dev/trystero@0.7.9";

var start = function() {
  const byId = document.getElementById.bind(document);
  const canvas = byId("canvas");
  const chat = byId("chat");
  const chatbox = byId("chatbox");
  const chatbutton = byId("chatbutton");
  const talkbutton = byId("talkbutton");
  const mutebutton = byId("mutebutton");
  const iframe = byId("iframe");
  //const peerInfo = byId("peer-info");
  //const noPeersCopy = peerInfo.innerText;
  const config = { appId: "trystero-glitch" };
  const cursors = {};
  const roomCap = 33;
  const fruits = [
    "🍏",
    "🍎",
    "🍐",
    "🍊",
    "🍋",
    "🍌",
    "🍉",
    "🍇",
    "🍓",
    "🍈",
    "🍒",
    "🍑",
    "🥭",
    "🍍",
    "🥥",
    "🥝"
  ];
  const randomFruit = () => fruits[Math.floor(Math.random() * fruits.length)];

  let mouseX = 0;
  let mouseY = 0;
  let room;
  let sendMove;
  let sendClick;
  let sendChat;
  let sendPeer;
  let sendCmd;

  const peerAlias = {};
  
  var streams = [];
  // sidepeer for calls only
  var peerId = selfId + "_call";
  var userName = false;
  //var peer = new Peer(peerId);

  // Room Selector
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  if (urlParams.has("room")) { 
    init(urlParams.get("room"))
  } else {
    init(99);                            
  }  
  
  if (urlParams.has("username")) { 
    userName = urlParams.get("username");
  }  
  
  // focus on chat input all the time
  var focus = function(){
      document.getElementById('chatbox').focus();
  }; focus();
  window.addEventListener('focus', focus);
  
  document.documentElement.className = "ready";
  addCursor(selfId, true);

  window.addEventListener("mousemove", ({ clientX, clientY }) => {
    mouseX = clientX / window.innerWidth;
    mouseY = clientY / window.innerHeight;
    moveCursor([mouseX, mouseY], selfId);
    if (room) {
      sendMove([mouseX, mouseY]);
    }
  });

  window.addEventListener("click", () => {
    const payload = [randomFruit(), mouseX, mouseY];
    dropFruit(payload);
    if (room) {
      sendClick(payload);
    }
  });

  window.addEventListener("touchstart", e => {
    const x = e.touches[0].clientX / window.innerWidth;
    const y = e.touches[0].clientY / window.innerHeight;
    const payload = [randomFruit(), x, y];

    dropFruit(payload);
    moveCursor([x, y], selfId);

    if (room) {
      sendMove([x, y]);
      sendClick(payload);
    }
  });

  window.chat = function(msg) {
    if (!msg || msg.length < 1) return;
    updateChat(msg, selfId);
    if (room) sendChat(msg);
    return;
  };
  chatbox.addEventListener("keypress", function(e) {
    if (e.keyCode == 13) {
      window.chat(chatbox.value);
      chatbox.value = "";
      return false;
    }
  });
  
  chatbutton.addEventListener("click", () => {
    window.chat(chatbox.value);
    chatbox.value = "";
    return false;
  });
  
  var streaming = false;
  var muted = false;
  talkbutton.addEventListener("click", async () => {
    if (!streaming){
      var stream = await navigator.mediaDevices.getUserMedia({audio:true, video:true});
      room.addStream(stream);
      handleStream(stream, selfId);
      streaming = stream;
      muted = false;
      talkbutton.innerHTML = '<i class="fa fa-phone fa-2x" aria-hidden="true" style="color:white;"></i>';
      talkbutton.style.background = "red";
      // notify network
      sendCmd({peerId: peerId, cmd: "hand", state: true });
    } else {
      console.log('')
      room.removeStream(streaming);
      var tracks = streaming.getTracks();
      tracks.forEach(function(track) {
        track.stop();
      });
      var el = byId("vid_" + selfId )
      el.srcObject = null;
      streaming = null;
      // reset mute
      mutebutton.innerHTML = '<i class="fa fa-microphone fa-2x" aria-hidden="true"></i>';
      muted = false;
      // reset call button
      talkbutton.innerHTML = '<i class="fa fa-phone fa-2x" aria-hidden="true" style="color:green;"></i>';
      talkbutton.style.background = "";
      // notify network
      sendCmd({peerId: peerId, cmd: "stop_video"});
      sendCmd({peerId: peerId, cmd: "hand", state: false });
    }  
    mutebutton.disabled = streaming ? false : true;
  })
  
  mutebutton.addEventListener("click", async () => {
    if (!streaming) return;
    var state = streaming.getAudioTracks()[0].enabled;
    if (!muted){
      mutebutton.innerHTML = '<i class="fa fa-microphone-slash fa-2x" aria-hidden="true"></i>';
      muted = true;
      streaming.getAudioTracks()[0].enabled = false;
    } else {
      mutebutton.innerHTML = '<i class="fa fa-microphone fa-2x" aria-hidden="true"></i>';
      muted = false;
      streaming.getAudioTracks()[0].enabled = true;
    }
    
  });
  
  async function init(n) {
    const ns = "room" + n;
    const members = 1;

    let getMove;
    let getClick;
    let getChat;
    let getPeer;
    let getCmd;

    if (members === roomCap) {
      return init(n + 1);
    }

    room = joinRoom(config, ns);
    window.room = room;
    window.roomId = n;
    window.self = selfId;
    [sendMove, getMove] = room.makeAction("mouseMove");
    [sendClick, getClick] = room.makeAction("click");
    [sendChat, getChat] = room.makeAction("chat");
    [sendCmd, getCmd] = room.makeAction("cmd");

    byId("room-num").innerText = "room #" + n;
    room.onPeerJoin(addCursor);
    room.onPeerLeave(removeCursor);
    room.onPeerStream(handleStream);
    getMove(moveCursor);
    getClick(dropFruit);
    getChat(updateChat);
    getCmd(handleCmd);
    
    //iframe.src = "https://excalidraw.com/#room="+selfId+",00"+selfId;
    
  }
  
  function handleCmd (data, id){
    if(id == selfId) return;
    console.log('got cmd', data, id)
    if (data){
      if (data.cmd == "stop_video" && data.peerId){
        var el = byId("vid_" + id);
        if (el) el.srcObject = null;
        // which one is it? :)
        el = byId("vid_" + peerId);
        if (el) el.srcObject = null;
      } else 
      if (data.cmd == "hand"){
        var el = byId("hand_" + id);
        if (el && data.state) el.classList.add("handgreen");
        else el.classList.remove("handgreen");
      } else 
      if (data.cmd == "username" && data.username){
        var el = byId("name_" + id);
        el.innerText = data.username;
      }
    }
  }
  
  function handleStream (stream, peerId) {
    if(peerId == selfId) { 
      var selfStream = stream;
      stream = new MediaStream(selfStream.getVideoTracks());
    }
    var el = byId("vid_" + peerId);
    if (!el) console.error('target video frame not found!', peerId)
    //console.log('received stream', stream, peerId, el);
    setTimeout(function () {
      el.setAttribute('autoplay', true);
      el.setAttribute('inline', true);
      el.setAttribute('height', 240);
      el.setAttribute('width', 480);
      el.srcObject = stream;
    }, 200);
  }
  
  function moveCursor([x, y], id) {
    const el = cursors[id];

    if (el) {
      el.style.left = x * window.innerWidth + "px";
      el.style.top = y * window.innerHeight + "px";
    }
  }

  function addCursor(id, isSelf) {
    const el = document.createElement("div");
    const img = document.createElement("img");
    img.id = "hand_" + id;
    const txt = document.createElement("p");
    txt.id = "name_" + id;
    const video = document.createElement("video");
    video.id = "vid_" + id;
    video.className = "video-circle";
    //video.addEventListener('loadedmetadata', function(data) { console.log('metaload',data) });

    el.style.float = "left";
    el.className = `cursor${isSelf ? " self" : ""}`;
    el.style.left = el.style.top = "-99px";
    img.src = "static/hand.png";
    txt.innerText = isSelf ? "you" : id.slice(0, 4);
    el.appendChild(img);
    el.appendChild(txt);
    el.appendChild(video);
    canvas.appendChild(el);
    cursors[id] = el;

    if (!isSelf) {
      updatePeerInfo();
    }
    
    if (userName && sendCmd) sendCmd({peerId: peerId, cmd: "username", username: userName });
    
    return el;
  }

  function removeCursor(id) {
    if (cursors[id]) {
      canvas.removeChild(cursors[id]);
    }
    if (streams[id]) {
      room.removeStream(streams[id], id);
      streams[id] = false;
    }
    updatePeerInfo();
  }

  function updatePeerInfo() {
    const count = room.getPeers().length;
    byId("room-num").innerText = "room #" + window.roomId + ` (${count})`;
    /*
    peerInfo.innerHTML = count
      ? `Right now <em>${count}</em> other peer${
          count === 1 ? " is" : "s are"
        } connected with you. Send them some fruit.`
      : noPeersCopy;
    */
  }

  function updateChat(msg, id) {
    
    if (isValidHttpUrl(msg) && id != selfId) { 
      var open = window.confirm(id+' is sharing a url. Trust it?');
      if (open) {
        // Save it!
        console.log('opening remote link.');
        //iframe.src = msg; // "https://excalidraw.com/#room="+selfId+",00"+selfId;
        window.open(msg, '_blank');
      } else {
        // Do nothing!
        console.log('Ignoring remote link.', id, selfId);
        chat.innerHTML = id + ":" + msg + "<br/>" + chat.innerHTML;
      }  
    } 
    
    chat.innerHTML = id + ":" + msg + "<br/>" + chat.innerHTML;
    
  }

  function dropFruit([fruit, x, y]) {
    const el = document.createElement("div");
    el.className = "fruit";
    el.innerText = fruit;
    el.style.left = x * window.innerWidth + "px";
    el.style.top = y * window.innerHeight + "px";
    canvas.appendChild(el);
    setTimeout(() => canvas.removeChild(el), 3000);
  }
  
  function isValidHttpUrl(string) {
    let url;
    try {
      url = new URL(string);
    } catch (_) {
      return false;  
    }
    return url.protocol === "http:" || url.protocol === "https:";
  }

};

start();

