"use client";
import { useRef, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const socket: Socket = io("http://localhost:4000");

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(4);
  const [history, setHistory] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [users, setUsers] = useState(0);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = window.innerWidth - 100;
    canvas.height = window.innerHeight - 200;
    const context = canvas.getContext("2d")!;
    context.lineCap = "round";
    setCtx(context);

    socket.on("draw", drawFromServer);
    socket.on("clear", clearCanvas);
    socket.on("loadCanvas", (lines) => lines.forEach(drawFromServer));

    return () => {
      socket.off("draw");
      socket.off("clear");
      socket.off("loadCanvas");
    };
  }, []);

  const drawFromServer = (data: any) => {
    if (!ctx) return;
    const { x, y, color, brushSize } = data;
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const startDrawing = (e: React.MouseEvent) => {
    if (!ctx) return;
    setDrawing(true);
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  const draw = (e: React.MouseEvent) => {
    if (!drawing || !ctx) return;
    const { offsetX, offsetY } = e.nativeEvent;
    const drawData = { x: offsetX, y: offsetY, color, brushSize };
    socket.emit("draw", drawData);
    drawFromServer(drawData);
  };

  const stopDrawing = () => {
    if (!ctx) return;
    setDrawing(false);
    ctx.beginPath();
    const snapshot = canvasRef.current!.toDataURL();
    setHistory((prev) => [...prev, snapshot]);
    setRedoStack([]);
  };

  const undo = () => {
    if (history.length === 0) return;
    const prev = [...history];
    const last = prev.pop();
    setRedoStack((r) => [...r, last!]);
    setHistory(prev);
    const img = new Image();
    img.src = prev[prev.length - 1];
    img.onload = () => ctx?.drawImage(img, 0, 0);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = [...redoStack];
    const last = next.pop();
    setRedoStack(next);
    setHistory((h) => [...h, last!]);
    const img = new Image();
    img.src = last!;
    img.onload = () => ctx?.drawImage(img, 0, 0);
  };

  const clearCanvas = () => {
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const clearAll = () => {
    socket.emit("clear");
    clearCanvas();
  };

  const saveDrawing = () => {
    const link = document.createElement("a");
    link.download = "canvas.png";
    link.href = canvasRef.current!.toDataURL();
    link.click();
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-3">🎨 Collaborative Canvas</h1>
      <div className="flex gap-3 mb-3">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
        <input type="range" min="2" max="20" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} />
        <button className="px-3 py-1 bg-blue-500 text-white rounded" onClick={undo}>Undo</button>
        <button className="px-3 py-1 bg-blue-500 text-white rounded" onClick={redo}>Redo</button>
        <button className="px-3 py-1 bg-red-500 text-white rounded" onClick={clearAll}>Clear</button>
        <button className="px-3 py-1 bg-green-500 text-white rounded" onClick={saveDrawing}>Save</button>
      </div>
      <canvas
        ref={canvasRef}
        className="border border-gray-400 bg-white rounded"
        onMouseDown={startDrawing}
        onMouseUp={stopDrawing}
        onMouseMove={draw}
      />
    </div>
  );
}
