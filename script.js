import { joinRoom, selfId } from "https://cdn.skypack.dev/trystero";
// import { apply, generate, merge } from "https://cdn.skypack.dev/json-merge-patch"
import quickLru from 'https://cdn.skypack.dev/quick-lru@6.1.2';
const lru = new quickLru({maxSize: 1000});

var doc = {};

var start = function() {
  const byId = document.getElementById.bind(document);
  const canvas = byId("canvas");
  const whiteboard = byId("whiteboard");
  const ctx = whiteboard.getContext("2d");
  whiteboard.width = window.innerWidth;
  whiteboard.height = window.innerHeight;

  const circle = byId("list");
  const chat = byId("chat");
  const chatbox = byId("chatbox");
  const chatbutton = byId("chatbutton");
  const talkbutton = byId("talkbutton");
  const mutebutton = byId("mutebutton");
  const shareButton = byId("share-button");
  const shareScreenButton = byId("share-screen");
  const shareView = byId("shareview");
  const peerGrid = byId("peer-grid");
  var features = { audio: true, video: true };

  document.addEventListener("visibilitychange", function(event) {
    sendCmd({ peerId: peerId, cmd: "hand", focus: document.visibilityState });
  });
  



  //const peerInfo = byId("peer-info");
  //const noPeersCopy = peerInfo.innerText;
  const config = { appId: "ctzn-glitch" };
  const cursors = {};
  const roomCap = 33;
  const fcIcons = [
    "🎩",
    "⏩",
    "🟪",
    "🔵",
    "🍌",
    "🥝",
    "⌐◨-◨",
    "🎩",
    "🎩",
    "🎩",
    "🎩"
  ];
  const randomFCIcon = () => fcIcons[Math.floor(Math.random() * fcIcons.length)];

  let mouseX = 0;
  let mouseY = 0;
  let room;
  let rooms;
  let sendMove;
  let sendClick;
  let sendChat;
  let sendPeer;
  let sendCmd;
  let sendPic;

  const peerAlias = {};

  var streams = [];
  var screens = [];
  // sidepeer for calls only
  var peerId = selfId + "_call";
  var userName = false;
  var roomName = false;

  // Room Selector
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  if (urlParams.has("room")) {
    roomName = urlParams.get("room");
    init(roomName);
  } else {
    getRoomName();
    //roomName = "lobby";
    //init(roomName);
  }
  if (urlParams.has("video") || features.video) {
    features.video = true;
    talkbutton.innerHTML =
      '<i class="fa fa-video fa-2x" aria-hidden="true"></i>';
  }
  if (urlParams.has("audio")) {
    features.video = true;
    talkbutton.innerHTML =
      '<i class="fa fa-video fa-2x" aria-hidden="true"></i>';
  }

  if (urlParams.has("username")) {
    userName = urlParams.get("username");
    //console.log("set localstorage");
    localStorage.setItem("username", userName);
  } else {
    if (localStorage.getItem("username")) {
      userName = localStorage.getItem("username");
    } else {
      //userName = prompt("Whats your name, stranger?") || selfId;
      getUserName();
      //localStorage.setItem("username", userName);
    }
  }

  // reformat URL for easy sharing
  var refresh =
      window.location.protocol +
      "//" +
      window.location.host +
      window.location.pathname +
      "?room=" +
      roomName;
  window.history.pushState({ path: refresh }, "", refresh);
  
  
 
  document.documentElement.className = "ready";
  addCursor(selfId, true);

  var isDrawing = false;
  var plots = [];
  var rect = canvas.getBoundingClientRect();
  var offsetX = rect.left;
  var offsetY = rect.top;
  window.addEventListener("mouseup", e => {
    //console.log('mouse stop');
    isDrawing = false;
    sendCmd({ peerId: selfId, cmd: "draw", plots: plots, color: "#855DCC" });
    plots = [];
  });
  window.addEventListener("mousedown", e => {
    //console.log('mouse start');
    isDrawing = true;
  });

  window.addEventListener("mousemove", ({ clientX, clientY, buttons }) => {
    mouseX = clientX / window.innerWidth;
    mouseY = clientY / window.innerHeight;
    moveCursor([mouseX, mouseY], selfId);
    if (room) {
      sendMove([mouseX, mouseY]);
    }

    if (isDrawing) {
      if (plots.length>50){
        sendCmd({ peerId: selfId, cmd: "draw", plots: plots, color: "#855DCC" });
        plots = [];
      }
      plots.push({ x: mouseX, y: mouseY });
      //drawOnCanvas(userStroke, plots, true);
    }
  });

  window.addEventListener("click", () => {
    const payload = [randomFCIcon(), mouseX, mouseY];
    dropFCIcon(payload);
    if (room) {
      sendClick(payload);
    }
  });

  window.addEventListener("touchstart", e => {
    const x = e.touches[0].clientX / window.innerWidth;
    const y = e.touches[0].clientY / window.innerHeight;
    const payload = [randomFCIcon(), x, y];

    dropFCIcon(payload);
    moveCursor([x, y], selfId);

    if (room) {
      sendMove([x, y]);
      sendClick(payload);
    }
  });
  

  window.addEventListener("click", () => {
    const payload = [randomFCIcon(), mouseX, mouseY];
    dropFCIcon(payload);
    if (room) {
      sendClick(payload);
    }
  });

  

  var streaming = false;
  var muted = false;
  talkbutton.addEventListener("click", async () => {
    //console.log("call button");
    if (!streaming) {
      var stream = await navigator.mediaDevices.getUserMedia(features);
      room.addStream(stream);
      handleStream(stream, selfId);
      streaming = stream;
      muted = false;
      talkbutton.innerHTML = !features.video
        ? '<i class="fa fa-phone fa-2x" aria-hidden="true" style="color:white;"></i>'
        : '<i class="fa fa-video fa-2x" aria-hidden="true" style="color:white;"></i>';
      talkbutton.style.background = "red";
      // notify network
      sendCmd({ peerId: peerId, cmd: "hand", state: true });
    } else {
      room.removeStream(streaming);
      var tracks = streaming.getTracks();
      tracks.forEach(function(track) {
        track.stop();
      });
      var el = byId("vid_" + selfId);
      el.srcObject = null;
      streaming = null;
      // reset mute
      mutebutton.innerHTML =
        '<i class="fa fa-microphone fa-2x" aria-hidden="true"></i>';
      muted = false;
      // reset call button
      talkbutton.innerHTML = !features.video
        ? '<i class="fa fa-phone fa-2x" aria-hidden="true" style="color:green;"></i>'
        : '<i class="fa fa-video fa-2x" aria-hidden="true"></i>';
      talkbutton.style.background = "";
      // notify network
      sendCmd({ peerId: peerId, cmd: "stop_video" });
      sendCmd({ peerId: peerId, cmd: "hand", state: false });
    }
    mutebutton.disabled = streaming ? false : true;
  });

  mutebutton.addEventListener("click", async () => {
    if (!streaming) return;
    var state = streaming.getAudioTracks()[0].enabled;
    if (!muted) {
      mutebutton.innerHTML =
        '<i class="fa fa-microphone-slash fa-2x" aria-hidden="true"></i>';
      muted = true;
      streaming.getAudioTracks()[0].enabled = false;
    } else {
      mutebutton.innerHTML =
        '<i class="fa fa-microphone fa-2x" aria-hidden="true"></i>';
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
    let getPic;

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
    [sendPic, getPic] = room.makeAction("pic");

    byId("room-num").innerText = "#" + n;
    room.onPeerJoin(addCursor);
    room.onPeerLeave(removeCursor);
    room.onPeerStream(handleStream);
    getMove(moveCursor);
    getClick(dropFCIcon);
    getChat(updateChat);
    getCmd(handleCmd);
    console.log('handlePic',handlePic);
    getPic(handlePic);

    // mappings
    window.ctl = { sendCmd: sendCmd, sendPic: sendPic, peerId: selfId };
  }
  
  // EXPERIMENTAL ROOM INDEXING!
  async function allrooms(n) {
    const ns = "rooms";
    rooms = joinRoom({ appId: "ctzn-glitch-index" }, ns);
    window.rooms = rooms;
    rooms.onPeerJoin(addRooms);
    rooms.onPeerLeave(removeRooms);
  }
  function addRooms(id, isSelf){
    console.log('new room created', id);
    // add div
  }
  function removeRooms(id){
    console.log('room destroyed', id)
    // remove div
  }
  

  // binary pic handler
  function handlePic(data, id, meta) {
    if (id == selfId) return;
    //console.log("got imagery", id, meta);
    var img = document.createElement("img");
    img.src = URL.createObjectURL(new Blob([data]));
    img.onload = function() {
      console.log("img.src", img.src);
      ctx.drawImage(
        img,
        meta.pos.x * window.innerWidth,
        meta.pos.y * window.innerHeight
      );
    };
  }
  // command handler
  function handleCmd(data, id) {
    if (id == selfId) return;
    //console.log("got cmd", data, id);
    if (data) {
      if (data.cmd == "stop_video" && data.peerId) {
        var el = byId("vid_" + id);
        if (el) el.srcObject = null;
        // which one is it? :)
        el = byId("vid_" + peerId);
        if (el) el.srcObject = null;
      } else if (data.cmd == "hand") {
        if (data.focus) {
          // handle focus
          var el = byId("cursor_" + id);
          if (el && data.focus == "hidden") el.classList.add("handoff");
          else el.classList.remove("handoff");
          var el = byId("circle_" + id);
          if (el && data.focus == "hidden") el.classList.add("handoff");
          else el.classList.remove("handoff");
        } else {
          // handle state
          var el = byId("hand_" + id);
          if (el && data.state) el.classList.add("handgreen");
          else el.classList.remove("handgreen");
          var el = byId("circle_" + id);
          if (el && data.state) el.classList.add("handgreen");
          else el.classList.remove("handgreen");
        }
      } else if (data.cmd == "username" && data.username) {
        var el = byId("name_" + id);
        if (el) el.innerText = data.username;
        var us = byId("user_" + id);
        if (us) us.innerText = data.username;
      } else if (data.cmd == "img" && data) {
        console.log("got image", data);
        displayImageOnCanvas(data.img, data.pos);
      } else if (data.cmd == "draw" && data.plots) {
        if (data.plots && data.color) drawOnCanvas(data.color, data.plots);
      } else if (data.cmd == "clear") {
        if (whiteboard) whiteboard.width = whiteboard.width;
      } else if (data.cmd == "screenshare") {
        //console.log("remote screenshare session incoming", data);
        shareScreenButton.disabled = true;
        screens[data.stream] = true;
      } else if (data.cmd == "stop_screenshare") {
        //console.log("remote screenshare session stop", data);
        shareScreenButton.disabled = false;
        screens[data.stream] = false;
        shareView.srcObject = null;
      }

      // whiteboard.width = whiteboard.width;
    }
  }

  function handleStream(stream, peerId, meta) {
    //console.log('got stream!', peerId, stream)
    if (stream && screens[stream.id]) {
      // screensharing payload
      var el = shareView;
      setTimeout(function() {
        el.setAttribute("autoplay", true);
        el.setAttribute("inline", true);
        //el.setAttribute("height", 240);
        el.setAttribute("width", "100%");
        el.srcObject = stream;
      }, 200);
    } else {
      // videocall payload
      //console.log("handling stream", stream, peerId);
      if (peerId == selfId) {
        var selfStream = stream;
        stream = new MediaStream(selfStream.getVideoTracks());
      }
      var el = byId("vid_" + peerId);
      if (!el) console.error("target video frame not found!", peerId);
      //console.log('received stream', stream, peerId, el);
      setTimeout(function() {
        el.setAttribute("autoplay", true);
        el.setAttribute("inline", true);
        el.setAttribute("height", 240);
        el.setAttribute("width", 480);
        el.srcObject = stream;
      }, 200);
    }
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
    el.id = "cursor_" + id;
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

    if (userName && sendCmd) {
      sendCmd({ peerId: selfId, cmd: "username", username: userName });
    }

    // video circle attempt
    var li = document.createElement("li");
    li.className = "list-item";
    li.id = "circle_" + id;
    var inner_txt = document.createElement("p");
    inner_txt.innerText = isSelf ? "you" : id.slice(0, 4);
    inner_txt.className = "list-text";
    inner_txt.id = "user_" + id;
    li.appendChild(inner_txt);
    //li.appendChild(video);
    circle.appendChild(li);
    updateLayout(circle);
    
    // are we sharing?
    if (screenSharing){
       console.log('wea re still screensharing!',screenSharing.id)
       sendCmd({
        peerId: selfId + "_screen",
        cmd: "screenshare",
        stream: screenSharing.id
      });
    }

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

    var li = byId("circle_" + id);
    circle.removeChild(li);
    updateLayout();

    updatePeerInfo();
  }

  function updatePeerInfo() {
    const count = room.getPeers().length;
    byId("room-num").innerText = "#" + window.roomId + ` (${count})`;
    if (userName && sendCmd) {
      sendCmd({ peerId: selfId, cmd: "username", username: userName });
    }
    /*
    peerInfo.innerHTML = count
      ? `Right now <em>${count}</em> other peer${
          count === 1 ? " is" : "s are"
        } connected with you. Send them some fruit.`
      : noPeersCopy;
    */
  }

  function updateChat(data, id) {
    var msg = data.msg;
    var user = data.username || id;

    if (isValidHttpUrl(msg) && id != selfId) {
      //var open = window.confirm(user + " is sharing a url. Trust it?");
      //if (open) {
      //console.log("opening remote link.");
      window.open(msg, "_blank");
      chat.innerHTML =
        user +
        ": <a href='" +
        msg +
        "' target='_blank' style='color:blue;'>" +
        msg +
        "</a><br/>" +
        chat.innerHTML;
      //}
    } else {
      chat.innerHTML = user + ": " + msg + "<br/>" + chat.innerHTML;
    }
  }

  function dropFCIcon([fruit, x, y]) {
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

  /* globals for compatibility */

  window.clearCanvas = function() {
    if (whiteboard) whiteboard.width = whiteboard.width;
    sendCmd({ peerId: selfId, cmd: "clear" });
  };

  window.shareUrl = function() {
    var url = "https://warpcast.com/~/compose?text=https://tophattalks.vercel.app";
    window.open(url, '_blank');
  
   /*  if (!window.getSelection) {
      alert("Clipboard not available, sorry!");
      return;
    }
    const dummy = document.createElement("p");
    dummy.textContent = window.location.href;
    document.body.appendChild(dummy);

    const range = document.createRange();
    range.setStartBefore(dummy);
    range.setEndAfter(dummy);

    const selection = window.getSelection();
    // First clear, in case the user already selected some other text
    selection.removeAllRanges();
    selection.addRange(range);

    document.execCommand("copy");
    document.body.removeChild(dummy);

    notifyMe("link shared to clipboard");
    if (shareButton) {
      shareButton.innerHTML =
        '<i class="fa fa-share-alt-square fa-1x" aria-hidden="true"></i>';
      setTimeout(function() {
        shareButton.innerHTML =
          '<i class="fa fa-share-alt fa-1x" aria-hidden="true"></i>';
      }, 1000);
    }
     */
  };
  
  function notifyMe(msg) {
    // Let's check if the browser supports notifications
    if (!("Notification" in window)) {
      alert(msg);
    }

    // Let's check whether notification permissions have already been granted
    else if (Notification.permission === "granted") {
      // If it's okay let's create a notification
      var notification = new Notification(msg);
    }

    // Otherwise, we need to ask the user for permission
    else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(function(permission) {
        // If the user accepts, let's create a notification
        if (permission === "granted") {
          var notification = new Notification(msg);
        }
      });
    }

    // At last, if the user has denied notifications, and you
    // want to be respectful there is no need to bother them any more.
  }

  function drawOnCanvas(color, plots, local) {
    // x * window.innerWidth
    if (!plots[0]) return;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.moveTo(plots[0].x * window.innerWidth, plots[0].y * window.innerHeight);
    for (var i = 1; i < plots.length; i++) {
      fadeOutCanvas();
      ctx.lineTo(
        plots[i].x * window.innerWidth,
        plots[i].y * window.innerHeight
      );
    }
    ctx.stroke();
  }

  
  function fadeOutCanvas() {
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fillRect(0, 0, whiteboard.width, whiteboard.height);
  }

  var screenSharing = false;
  window.shareScreen = async function() {
    if (!screenSharing) {
      var stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        frameRate: 5
      });
      sendCmd({
        peerId: selfId + "_screen",
        cmd: "screenshare",
        stream: stream.id
      });
      room.addStream(stream);
      shareScreenButton.classList.add("blinking");
      screenSharing = stream;
      shareView.srcObject = screenSharing;
    } else {
      sendCmd({
        peerId: peerId,
        cmd: "stop_screenshare",
        stream: screenSharing.id
      });
      room.removeStream(screenSharing);
      var tracks = screenSharing.getTracks();
      tracks.forEach(function(track) {
        track.stop();
      });
      //var el = byId("vid_" + selfId);
      //el.srcObject = null;
      shareScreenButton.classList.remove("blinking");
      shareView.srcObject = null;
      screenSharing = false;
    }
  };

  function getUserName() {
    Swal.fire({
      title: "Hey Stranger!",
      text: "Choose a Username:",
      input: "text"
    }).then(result => {
      if (result.value) {
        //console.log('got username',result.value)
        userName = result.value || selfId;
        localStorage.setItem("username", userName);
        sendCmd({ peerId: selfId, cmd: "username", username: userName });
      }
    });
  }
  window.getUserName = getUserName;
  
  function getRoomName() {
    Swal.fire({
      title: "Welcome Stranger!",
      text: "Create or Join a Room",
      input: "text",
      inputPlaceholder: "lobby"
    }).then(result => {
      if (result.value) {
        //console.log('got username',result.value)
        if (!result.value || result.value.length < 4) result.value = 'lobby';
        var target = location.protocol + '//' + location.host + location.pathname + '?room=' + result.value;
        window.location = target;
      }
    });
  }
  window.getRoomName = getRoomName;
  
  function reJoinRoom() {
    window.room.leave();
    Swal.fire(
      "Disconnected!",
      "Click to Rejoin",
      "success"
    ).then(result => {
        window.location.reload();
    });
  }
  window.reJoinRoom = reJoinRoom;

  /* circle layout functions */

  function updateLayout() {
    var listItems = document.getElementsByClassName("list-item");
    for (var i = 0; i < listItems.length; i++) {
      var offsetAngle = 360 / listItems.length;
      var rotateAngle = offsetAngle * i;
      var el = byId(listItems[i].id);
      el.style.transform =
        "rotate(" +
        rotateAngle +
        "deg) translate(0, -80px) rotate(-" +
        rotateAngle +
        "deg)";
    }
  }

  function addCircle(item) {
    var list = document.getElementById("list");
    list.append(item);
  }

  var deleteCircle = function(e) {
    var list = document.getElementById("list");
    e.parent().remove();
  };
  
  
  
};

start();
