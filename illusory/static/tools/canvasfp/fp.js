//GenerateCanvasFP 生成 Canvas 指纹
function GenerateCanvasFP() {
  // 1.绘制获取base64
  const base64 = getComplexCanvasFingerprint()
  // 2.提取CRC32校验码作为Canvas指纹
  return extractCRC32FromBase64(base64)
}

//getComplexCanvasFingerprint 绘制复制图片并获取其base64数据
function getComplexCanvasFingerprint() {
  const asciiString = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ !\"#$%&\'()*+,-./0123456789:;<=>?@[\\]^_`{|}~";
  // modified script taken from https://browserleaks.com/canvas#how-does-it-work
  // 真正使用时直接创建一个 Canvas即可。
  // const canvas = document.createElement('canvas');
  const canvas = document.getElementById('myCanvas');
  const ctx = canvas.getContext('2d');
  // 默认尺寸为300*150 这里将宽度调大 不然字太多绘制不完
  canvas.setAttribute("width", "700")
  // canvas.setAttribute("height","300")
  ctx.textBaseline = "top";
  ctx.font = "17px Arial";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f60";
  ctx.fillRect(150, 1, 550, 25);
  ctx.fillStyle = "#069";
  ctx.fillText(asciiString, 2, 15);
  ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
  ctx.fillText(asciiString, 4, 17);

  ctx.font = "17px Helvetica";
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 10, 50);
  ctx.font = "17px Times New Roman";
  ctx.strokeStyle = 'rgba(102, 204, 0, 0.7)';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 12, 55);
  ctx.font = "17px Times";
  ctx.strokeStyle = '#069';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 14, 60);
  ctx.font = "17px Georgia";
  ctx.strokeStyle = '#FF7F00';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 16, 65);
  ctx.font = "17px Palatino";
  ctx.strokeStyle = '#9400D3';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 18, 70);
  ctx.font = "17px Garamond";
  ctx.strokeStyle = '#4B0082';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 20, 75);
  ctx.font = "17px Bookman";
  ctx.strokeStyle = '#0000FF';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 22, 80);
  ctx.font = "17px Comic Sans MS";
  ctx.strokeStyle = '#00FF00';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 24, 85);
  ctx.font = "17px Trebuchet MS";
  ctx.strokeStyle = '#FFFF00';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 26, 90);
  ctx.font = "17px Arial Black";
  ctx.strokeStyle = '#FF7F00';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 28, 95)
  ctx.font = "17px Impact";
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 30, 100)
  ctx.font = "17px Anurati";
  ctx.strokeStyle = '#9400D3';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 28, 105);
  ctx.font = "17px Verdana";
  ctx.strokeStyle = '#4B0082';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 26, 110);
  ctx.font = "17px Courier New";
  ctx.strokeStyle = '#0000FF';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 24, 115);
  ctx.font = "17px Baskerville";
  ctx.strokeStyle = '#00FF00';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 22, 120);
  ctx.font = "17px Century Gothic";
  ctx.strokeStyle = '#FFFF00';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 20, 125);
  ctx.font = "17px Tahoma";
  ctx.strokeStyle = '#FF7F00';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 18, 130);
  ctx.font = "17px Arial Narrow";
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 16, 135);
  ctx.font = "17px Trebuchet MS";
  ctx.strokeStyle = '#9400D3';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 14, 140);
  ctx.font = "17px Lucida Sans Typewriter";
  ctx.strokeStyle = '#4B0082';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 12, 145);
  ctx.font = "17px Consolas";
  ctx.strokeStyle = '#0000FF';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 10, 150);
  ctx.font = "17px cursive";
  ctx.strokeStyle = '#00FF00';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 14, 155);
  ctx.font = "17px fantasy";
  ctx.strokeStyle = '#FFFF00';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 16, 160);
  ctx.font = "17px monospace";
  ctx.strokeStyle = '#FF7F00';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 18, 165);
  ctx.font = "17px sans-serif";
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 20, 170);
  ctx.font = "17px serif";
  ctx.strokeStyle = '#9400D3';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 22, 175);
  ctx.font = "17px .Mondulkiri U GR 1.5";
  ctx.strokeStyle = '#4B0082';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 24, 180);
  ctx.font = "17px BPG Classic 99U";
  ctx.strokeStyle = '#0000FF';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 26, 185);
  ctx.font = "17px Bauhaus 93";
  ctx.strokeStyle = '#00FF00';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 28, 190);
  ctx.font = "17px Bookshelf Symbol 7";
  ctx.strokeStyle = '#FFFF00';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 30, 195);
  ctx.font = "17px Ming(for ISO10646)";
  ctx.strokeStyle = '#FF7F00';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 32, 200);
  ctx.font = "17px Modern No. 20";
  ctx.strokeStyle = '#FF0000';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 34, 205);
  ctx.font = "17px OCR-B 10 BT";
  ctx.strokeStyle = '#9400D3';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 36, 210);
  ctx.font = "17px Proxy 1";
  ctx.strokeStyle = '#4B0082';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 38, 215);
  ctx.font = "17px Proxy 9";
  ctx.strokeStyle = '#0000FF';
  ctx.lineWidth = 2;
  ctx.strokeText(asciiString, 40, 220);


  // Example fonts to add:
  // Luciana, Blanka, Atlantico, Elixia, Nidus Sans, Electro, Ultra, Geometric Hurricane, Raptor Sans, Lazerz Additktz, Fuerte
  // Ailerons, Beyno, Borg, Elianto, Exan-3, Azedo, Stellar, Neptune, UFO Nest, Arkhip, Dual, Astro, Halogen, Marske, Phage
  // Savone, Chronic, Good Times, Moki Mono, Nasalization, FM Pointifax, Oboe, Celari Titling, Outage, Finity, Lambok
  // Baron, Sacred Geometry, Mylodon, Beams, Wormbox, Strato, VGER, Digital, Yukarimobile, Dylovastuff, Three-Sixty Condensed, Neogray
  const grd = ctx.createLinearGradient(0, 0, 200, 0.2);
  grd.addColorStop(0, "rgba(102, 204, 0, 0.1)");
  grd.addColorStop(1, "#FF0000");
  ctx.fillStyle = grd;
  ctx.fillRect(10, 10, 150, 80);
  return canvas.toDataURL();
}

//spiltCRC32FromBase64 从  base64 中提取CRC32校验码
function extractCRC32FromBase64(base64) {
  // 移除 base64 header
  base64 = base64.replace('data:image/png;base64,', '')
  const bin = atob(base64)
  // 倒数16到12位是PNG数据中的CRC32校验码
  const crc32ASKii = bin.slice(-16, -12)
  // 转换为16进制
  return string2Hex(crc32ASKii.toString())
}

// string2Hex 字符串转16进制
function string2Hex(str) {
  let result = ""
  for (let i = 0; i < str.length; i++) {
    let askii = str.charCodeAt(i)
    if (askii < 0x0f) {
      // 小于0x0f转为16进制后在前面补零
      result += "0"
    }
    result += askii.toString(16).toLocaleUpperCase()
  }
  return result
}
