
// Helper for Stat Box
function drawStatBox(doc, x, y, bigText, smallText) {
    doc.save();
    doc.roundedRect(x, y, 150, 60, 5).fill('#333333');
    doc.fillColor('#ffffff');
    doc.fontSize(24).font('Helvetica-Bold').text(bigText, x, y + 10, { width: 150, align: 'center' });
    doc.fontSize(10).font('Helvetica').text(smallText, x, y + 40, { width: 150, align: 'center' });
    doc.restore();
}

// Render "Why Choose Us" Page
function renderWhyChooseUs(doc, quotation) {
    doc.addPage();

    // Header
    doc.fontSize(24).font('Helvetica-Bold').fillColor('#000000').text('Why Choose Us ?', 50, 50);
    doc.lineWidth(2).moveTo(50, 80).lineTo(250, 80).stroke();

    let y = 100;
    doc.fontSize(10).font('Helvetica');

    doc.text('You Need Professional help, & ', 50, y, { continued: true });
    doc.font('Helvetica-Bold').text(quotation.company_name || 'Vishwakarma Furniture Work', { continued: true });
    doc.font('Helvetica').text(' can make your dream home a reality!');
    y += 20;

    doc.text('We are a renowned architectural and interior design firm with over five years of experience in rajkot.', 50, y);
    y += 20;

    doc.text('With our professional team of twenty-five architectural and design experts,', 50, y);
    y += 15;
    doc.text('we are excellent at bringing your ideas of beautiful home to life.', 50, y);
    y += 25;

    doc.text('We are versatile and up to date with the latest trends in interior design.', 50, y);
    y += 15;
    doc.text('We usually plan the project according to the tastes and preferences of our clients and', 50, y);
    y += 15;
    doc.text('complement our expertise.', 50, y);
    y += 25;

    doc.text('We have experience with Traditional, Modern, Contemporary, Indian and International forms', 50, y);
    y += 15;
    doc.text('of interior Design.', 50, y);
    y += 50;

    // Our Vision
    doc.lineWidth(1).rect(50, y, 500, 50).stroke();
    doc.save();
    doc.rect(60, y - 10, 100, 20).fill('#ffffff'); // Mask top border for title
    doc.restore();
    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text('Our Vision', 65, y - 8);

    doc.fontSize(9).font('Helvetica').text('To be the first choice for anyone seeking an interior design firm in Rajkot that can provide a complete package of high-design and construction services.', 60, y + 15, { width: 480 });

    y += 80;

    // Our Mission
    doc.rect(50, y, 500, 50).stroke();
    doc.save();
    doc.rect(60, y - 10, 110, 20).fill('#ffffff');
    doc.restore();
    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text('Our Mission', 65, y - 8);

    doc.fontSize(9).font('Helvetica').text("Our mission is to create beautiful, sustainable and innovative spaces that will exceed our client's expectations.", 60, y + 20, { width: 480 });

    y += 90;

    // Stats Boxes
    const boxWidth = 150;
    const startX = 50;
    const gap = 25;

    drawStatBox(doc, startX, y, '10', 'Years in Industry');
    drawStatBox(doc, startX + boxWidth + gap, y, '150+', 'Skilled Workers');
    drawStatBox(doc, startX + (boxWidth + gap) * 2, y, '501+', 'Projects Completed');

    // Footer Box
    y = 730;
    doc.rect(50, y, 500, 70).lineWidth(1).stroke();

    doc.fillColor('#000000');
    doc.fontSize(10).font('Helvetica-Bold').text('Interior :', 60, y + 15);
    doc.font('Helvetica').text('Er. Bhautik C. Jethva', 110, y + 15);
    doc.text('Tel. 0281-299 2212', 110, y + 30);

    doc.font('Helvetica-Bold').text('Party Name :', 60, y + 50);
    doc.font('Helvetica').text(quotation.client_name, 130, y + 50);

    // Right side
    // Format numeric ID for display? User image shows #001
    const displayId = '#' + (quotation.id.toString().padStart(3, '0'));

    doc.font('Helvetica-Bold').text('Quotation :', 350, y + 15);
    doc.font('Helvetica').text(displayId, 420, y + 15);

    doc.font('Helvetica-Bold').text('Date :', 350, y + 30);
    doc.font('Helvetica').text(new Date(quotation.date).toLocaleDateString('en-GB'), 420, y + 30);
}

export { renderWhyChooseUs };
