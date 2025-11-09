const socket = io();
const canvas = document.getElementById('canvas');
const cursorsRoot = document.getElementById('cursors');
const usersEl = document.getElementById('users');
const colorEl = document.getElementById('color');
const widthEl = document.getElementById('width');
const eraserBtn = document.getElementById('eraser');
const undoBtn = document.getElementById('undo');
const redoBtn = document.getElementById('redo');

let dpr = Math.max(window.devicePixelRatio || 1, 1);
function fit() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', fit);
fit();

const ctx = canvas.getContext('2d');
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

let drawing = false, prev=null, isEraser=false;
let undoStack = []; // not authoritative; server keeps canonical history, but client can snapshot for instant undo UX

// utility: convert event -> canvas coords
function pos(e){
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX ?? (e.touches && e.touches[0].clientX)) - rect.left;
  const cy = (e.clientY ?? (e.touches && e.touches[0].clientY)) - rect.top;
  return { x: Math.round(cx), y: Math.round(cy) };
}

function drawOp(op){
  ctx.save();
  if(op.isEraser){
    // use destination-out for true erase
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = op.color;
  }
  ctx.lineWidth = op.width;
  ctx.beginPath();
  ctx.moveTo(op.prev.x, op.prev.y);
  ctx.lineTo(op.curr.x, op.curr.y);
  ctx.stroke();
  ctx.restore();
}

function replay(history){
  ctx.clearRect(0,0,canvas.width/dpr, canvas.height/dpr);
  for(const op of history) drawOp(op);
}

// pointer events
canvas.addEventListener('pointerdown', e=>{
  canvas.setPointerCapture(e.pointerId);
  drawing = true;
  prev = pos(e);
  undoStack.push(canvas.toDataURL()); // quick snapshot
  if(undoStack.length>50) undoStack.shift();
});
canvas.addEventListener('pointermove', e=>{
  const p = pos(e);
  socket.emit('cursor', p);
  if(!drawing) return;
  const op = { prev, curr: p, color: colorEl.value, width: parseInt(widthEl.value,10), isEraser };
  drawOp(op);
  socket.emit('drawing', op);
  prev = p;
});
canvas.addEventListener('pointerup', e=>{
  drawing=false; try{canvas.releasePointerCapture(e.pointerId);}catch(err){}
});
canvas.addEventListener('pointercancel', ()=>drawing=false);

// UI handlers
eraserBtn.addEventListener('click', ()=>{ isEraser = !isEraser; eraserBtn.textContent = isEraser ? 'Eraser ✓' : 'Eraser'; });
undoBtn.addEventListener('click', ()=> socket.emit('undo'));
redoBtn.addEventListener('click', ()=> socket.emit('redo'));

// socket handlers
socket.on('init', ({ history, users })=>{
  replay(history || []);
  users && renderUsers(users);
});
socket.on('drawing', op => drawOp(op));
socket.on('state', ({ history }) => replay(history || []));
socket.on('cursor', data => {
  let el = document.querySelector(`[data-cursor="${data.id}"]`);
  if(!el){
    el = document.createElement('div'); el.className='remote-cursor'; el.dataset.cursor = data.id;
    cursorsRoot.appendChild(el);
  }
  el.style.left = data.x + 'px';
  el.style.top = data.y + 'px';
  el.style.background = data.color || '#fff';
  el.textContent = '•';
});
socket.on('users', u=> renderUsers(u));

function renderUsers(users){
  usersEl.innerHTML = '<strong>Users:</strong>';
  for(const [id,info] of Object.entries(users)){
    const span = document.createElement('div');
    span.innerHTML = `<span style="color:${info.color}">${id}${id===socket.id ? ' (you)':''}</span>`;
    usersEl.appendChild(span);
  }
}
