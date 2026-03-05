import { Document, Packer, Paragraph, TextRun } from 'docx';
import html2pdf from 'html2pdf.js';

export const exportToTxt = (text: string) => {
    const element = document.createElement('a');
    const file = new Blob([text], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `transcript-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
};

export const exportToDocx = async (text: string) => {
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Live S2T Transcript",
                            bold: true,
                            size: 32,
                        }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Generated on: ${new Date().toLocaleString()}`,
                            italics: true,
                        }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "\n" + text,
                        }),
                    ],
                }),
            ],
        }],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcript-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.docx`;
    link.click();
    URL.revokeObjectURL(url);
};

export const exportToPdf = (text: string) => {
    const element = document.createElement('div');
    element.style.padding = '40px';
    element.style.color = '#000';
    element.style.fontFamily = 'Arial, sans-serif';
    element.innerHTML = `
    <h1 style="margin-bottom: 20px;">Live S2T Transcript</h1>
    <p style="color: #666; margin-bottom: 30px;">Generated on: ${new Date().toLocaleString()}</p>
    <div style="line-height: 1.6; white-space: pre-wrap;">${text}</div>
  `;

    const opt = {
        margin: 1,
        filename: `transcript-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const }
    };

    html2pdf().set(opt).from(element).save();
};
