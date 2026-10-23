export async function exportCake(capture, name, base, cream) {
  await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1500))]);
  // Two frames let selection changes and the final layout settle before capture.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const source = capture();
  const canvas = document.createElement('canvas');
  canvas.width = 1800; canvas.height = 1800;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#faf7f2'; ctx.fillRect(0, 0, 1800, 1800);
  ctx.textAlign = 'center'; ctx.fillStyle = '#59463c';
  ctx.font = '58px Georgia, serif'; ctx.fillText('Dream Cake Studio', 900, 150);
  ctx.font = '18px sans-serif'; ctx.fillStyle = '#a18e7d'; ctx.fillText('A LITTLE SWEETNESS, MADE BY YOU', 900, 200);
  const ratio = Math.min(1600 / source.width, 1260 / source.height);
  const w = source.width * ratio, h = source.height * ratio;
  const framed = document.createElement('canvas');
  framed.width = source.width; framed.height = source.height;
  const frame = framed.getContext('2d');
  frame.drawImage(source, 0, 0);
  // Soften the outer shadow at the canvas edge when composing the keepsake image.
  frame.globalCompositeOperation = 'destination-in';
  const fade = frame.createLinearGradient(0, 0, 0, source.height);
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.04, '#000');
  fade.addColorStop(0.86, '#000'); fade.addColorStop(1, 'rgba(0,0,0,0)');
  frame.fillStyle = fade; frame.fillRect(0, 0, source.width, source.height);
  ctx.drawImage(framed, (1800 - w) / 2, 260 + (1260 - h) / 2, w, h);
  ctx.fillStyle = '#59463c'; ctx.font = '40px "Noto Sans SC", sans-serif';
  ctx.fillText(name.trim() || '我的甜蜜时刻', 900, 1570, 1500);
  ctx.font = '24px "Noto Sans SC", sans-serif'; ctx.fillStyle = '#998675';
  ctx.fillText(`${base}  ·  ${cream}`, 900, 1630);
  ctx.font = 'italic 27px Georgia, serif'; ctx.fillText('Made by you, with love.', 900, 1710);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Image encoding failed');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `Dream-Cake-${name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').slice(0, 24) || 'creation'}.png`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
