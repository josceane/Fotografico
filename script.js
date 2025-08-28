// jsPDF disponível via CDN
const { jsPDF } = window.jspdf;

const inputFotos = document.getElementById('fotos');
const preview = document.getElementById('preview');
const btnPDF = document.getElementById('btnPDF');

inputFotos.addEventListener('change', () => {
  preview.innerHTML = '';
  let count = 0;
  for (const file of inputFotos.files) {
    if (count >= 18) break;
    count++;
    const reader = new FileReader();
    reader.onload = e => {
      const div = document.createElement('div');
      div.className = 'foto-item';
      div.innerHTML = `
        <img src="${e.target.result}" alt="foto">
        <input type="text" class="legenda" placeholder="Legenda da foto">
      `;
      preview.appendChild(div);
    };
    reader.readAsDataURL(file);
  }
});

function compressImage(imgSrc, maxWidth = 900, quality = 0.72) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = function() {
      const scale = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = imgSrc;
  });
}

async function addHeaderAndWatermark(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Carregar fundo (marca d'água)
  const fundoBlob = await (await fetch('assets/fundo.png')).blob();
  const fundoData = await blobToDataURL(fundoBlob);

  // Clarear imagem em um canvas
  const fundoClaro = await lightenImage(fundoData, 0.15); // 0.15 = bem clara

  // Carregar cabeçalho
  const cabecalhoBlob = await (await fetch('assets/cabecalho.png')).blob();
  const cabecalhoData = await blobToDataURL(cabecalhoBlob);

  // Inserir marca d’água no centro
  doc.addImage(fundoClaro, 'PNG',
               pageWidth*0.05, pageHeight*0.10,
               pageWidth*0.90, pageHeight*0.80);

  // Inserir cabeçalho no topo
  doc.addImage(cabecalhoData, 'PNG',
               10, 4, pageWidth-20, 22);

  // Linha divisória
  doc.setDrawColor(200);
  doc.line(10, 28, pageWidth-10, 28);
}

// Converte Blob em DataURL
function blobToDataURL(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

// Clareia imagem usando canvas
function lightenImage(dataUrl, opacity = 0.2) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      ctx.globalAlpha = opacity; // aplica transparência
      ctx.drawImage(img, 0, 0);

      resolve(canvas.toDataURL('image/png'));
    };
    img.src = dataUrl;
  });
}

btnPDF.addEventListener('click', gerarPDF);

async function gerarPDF(){
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const marginLeft = 14;
  let y = 34;

  await addHeaderAndWatermark(doc);

  doc.setFontSize(13);
  doc.setTextColor(0,0,0);

  function addText(label, value){
    if(!value) return;
    const text = `${label}: ${value}`;
    const lines = doc.splitTextToSize(text, 182);
    doc.text(lines, marginLeft, y);
    y += lines.length * 6 + 2;
  }

  addText('Local', document.getElementById('local').value);
  addText('Relatório nº', document.getElementById('numero').value);
  addText('Data', document.getElementById('data').value);
  addText('Órgãos envolvidos', document.getElementById('fiscais').value);
  addText('Solicitante', document.getElementById('solicitante').value);
  addText('Referência / Assunto', document.getElementById('referencia').value);

  y += 10;
  doc.setFontSize(14);
  // 🔹 Centralizar título
  doc.text('RELATÓRIO FOTOGRÁFICO', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
  doc.setFontSize(12);
  y += 10;

  // Fotos 2 por linha
  const fotos = document.querySelectorAll('.foto-item');
  let x = marginLeft;
  for (let i=0; i<fotos.length; i++) {
    const imgEl = fotos[i].querySelector('img');
    const legenda = fotos[i].querySelector('.legenda').value || '';

    const compressed = await compressImage(imgEl.src);
    doc.addImage(compressed, 'JPEG', x, y, 85, 64);
    const legLines = doc.splitTextToSize(legenda, 85);
    doc.text(legLines, x, y + 68);

    if (x === marginLeft) {
      x = marginLeft + 95; // segunda coluna
    } else {
      x = marginLeft;
      y += 88; // próxima linha de fotos
    }

    if (y > 250 || (i < fotos.length-1 && x !== marginLeft && y > 250)) {
      doc.addPage();
      await addHeaderAndWatermark(doc);
      y = 34;
      x = marginLeft;

      doc.setFontSize(14);
      doc.text('RELATÓRIO FOTOGRÁFICO', doc.internal.pageSize.getWidth() / 2, y, { align: 'center' });
      doc.setFontSize(12);
      y += 10;
    }
  }

  doc.save('relatorio-fotografico.pdf');
}
