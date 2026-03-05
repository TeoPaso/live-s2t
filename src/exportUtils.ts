import { Document, Packer, Paragraph, TextRun } from 'docx';
import jsPDF from 'jspdf';

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
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
    });

    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxLineWidth = pageWidth - margin * 2;

    // Title
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Live S2T Transcript', margin, margin + 20);

    // Date
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, margin + 45);

    // Body Text
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);

    // Split long text into manageable lines using built-in method
    const lines = doc.splitTextToSize(text, maxLineWidth);

    let y = margin + 80;
    const pageHeight = doc.internal.pageSize.getHeight();
    const lineHeight = 16;

    for (let i = 0; i < lines.length; i++) {
        if (y + lineHeight > pageHeight - margin) {
            doc.addPage();
            y = margin + 20; // Extra padding top on new page
        }
        doc.text(lines[i], margin, y);
        y += lineHeight;
    }

    doc.save(`transcript-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.pdf`);
};
