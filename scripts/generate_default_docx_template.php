<?php
/**
 * Generates an authentic default OpenXML DOCX Course Certificate template
 * for Vyomantra Technologies with formal styles, placeholders, and signature zones.
 */

$templateDir = dirname(__DIR__) . '/templates/certificates';
if (!is_dir($templateDir)) {
    mkdir($templateDir, 0777, true);
}

$templatePath = $templateDir . '/Course_Certificate_Template.docx';

$zip = new ZipArchive();
if ($zip->open($templatePath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    die("Failed to create zip file at $templatePath\n");
}

// 1. [Content_Types].xml
$contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/word/fontTable.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml"/>
</Types>';
$zip->addFromString('[Content_Types].xml', $contentTypes);

// 2. _rels/.rels
$rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>';
$zip->addFromString('_rels/.rels', $rels);

// 3. word/_rels/document.xml.rels
$docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable" Target="fontTable.xml"/>
</Relationships>';
$zip->addFromString('word/_rels/document.xml.rels', $docRels);

// 4. word/settings.xml
$settings = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:zoom w:percent="100"/>
</w:settings>';
$zip->addFromString('word/settings.xml', $settings);

// 5. word/fontTable.xml
$fonts = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:fontTable xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:font w:name="Calibri"><w:pitch w:val="variable"/><w:family w:val="swiss"/></w:font>
  <w:font w:name="Georgia"><w:pitch w:val="variable"/><w:family w:val="roman"/></w:font>
  <w:font w:name="Arial"><w:pitch w:val="variable"/><w:family w:val="swiss"/></w:font>
</w:fontTable>';
$zip->addFromString('word/fontTable.xml', $fonts);

// 6. word/document.xml - A4 Landscape (16838 x 11906 twips = 29.7cm x 21cm)
$documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>

    <!-- Top Border Line -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="120" w:after="80"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="18"/><w:color w:val="00A3C4"/></w:rPr>
        <w:t>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</w:t>
      </w:r>
    </w:p>

    <!-- Organization Header -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="60" w:after="40"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="44"/><w:color w:val="0B132B"/></w:rPr>
        <w:t>VYOMANTRA TECHNOLOGIES</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="160"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="18"/><w:color w:val="4A5568"/><w:spacing w:val="40"/></w:rPr>
        <w:t>RESEARCH, SOFTWARE &amp; ARTIFICIAL INTELLIGENCE LABS</w:t>
      </w:r>
    </w:p>

    <!-- Certificate Title -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="120" w:after="80"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="52"/><w:color w:val="1C2541"/></w:rPr>
        <w:t>CERTIFICATE OF COMPLETION</w:t>
      </w:r>
    </w:p>

    <!-- Certificate ID -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="180"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="20"/><w:color w:val="00A3C4"/></w:rPr>
        <w:t>Credential Identifier: </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="22"/><w:color w:val="00A3C4"/></w:rPr>
        <w:t>{{CERTIFICATE_ID}}</w:t>
      </w:r>
    </w:p>

    <!-- Proudly Presented To -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="80" w:after="80"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="20"/><w:color w:val="718096"/></w:rPr>
        <w:t>THIS IS PROUDLY CONFERRED UPON</w:t>
      </w:r>
    </w:p>

    <!-- Recipient Name -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="60" w:after="140"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="48"/><w:color w:val="0B132B"/><w:u w:val="single"/></w:rPr>
        <w:t>{{RECIPIENT_NAME}}</w:t>
      </w:r>
    </w:p>

    <!-- Statement & Course Name -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="80" w:after="60"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/><w:color w:val="2D3748"/></w:rPr>
        <w:t>for successfully fulfilling all rigorous curriculum requirements, projects, and assessments in</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="40" w:after="80"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="34"/><w:color w:val="00A3C4"/></w:rPr>
        <w:t>{{COURSE_NAME}}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="0" w:after="220"/>
      </w:pPr>
      <w:r>
        <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:i/><w:sz w:val="20"/><w:color w:val="4A5568"/></w:rPr>
        <w:t>Program Duration: {{COURSE_DURATION}}  •  Issue Date: {{ISSUE_DATE}}</w:t>
      </w:r>
    </w:p>

    <!-- Signatures & QR Code Table -->
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="14000" w:type="dxa"/>
        <w:jc w:val="center"/>
        <w:tblBorders>
          <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
          <w:insideH w:val="none"/><w:insideV w:val="none"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <!-- Cell 1: Trainer Signature (Digital) -->
        <w:tc>
          <w:tcPr><w:tcW w:w="4500" w:type="dxa"/><w:vAlign w:val="bottom"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:i/><w:b/><w:sz w:val="26"/><w:color w:val="2B6CB0"/></w:rPr>
              <w:t>{{TRAINER_SIGNATURE}}</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="CBD5E0"/></w:rPr>
              <w:t>_____________________________</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="18"/><w:color w:val="1A202C"/></w:rPr>
              <w:t>Santhosh S.</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="16"/><w:color w:val="718096"/></w:rPr>
              <w:t>Lead Technical Instructor</w:t>
            </w:r>
          </w:p>
        </w:tc>

        <!-- Cell 2: QR Code & Verification Center -->
        <w:tc>
          <w:tcPr><w:tcW w:w="5000" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="18"/><w:color w:val="00A3C4"/></w:rPr>
              <w:t>{{QR_CODE}}</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="14"/><w:color w:val="718096"/></w:rPr>
              <w:t>Scan to Verify Credential</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="14"/><w:color w:val="00A3C4"/></w:rPr>
              <w:t>{{VERIFICATION_URL}}</w:t>
            </w:r>
          </w:p>
        </w:tc>

        <!-- Cell 3: Founder & CEO Signature -->
        <w:tc>
          <w:tcPr><w:tcW w:w="4500" w:type="dxa"/><w:vAlign w:val="bottom"/></w:tcPr>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="40"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:i/><w:b/><w:sz w:val="26"/><w:color w:val="975A16"/></w:rPr>
              <w:t>{{FOUNDER_SIGNATURE}}</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="20"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="CBD5E0"/></w:rPr>
              <w:t>_____________________________</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:sz w:val="18"/><w:color w:val="1A202C"/></w:rPr>
              <w:t>S.B. Sachin</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr><w:jc w:val="center"/><w:spacing w:after="0"/></w:pPr>
            <w:r>
              <w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="16"/><w:color w:val="718096"/></w:rPr>
              <w:t>Founder &amp; CEO</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>

    <!-- Bottom Page Layout: A4 Landscape (16838 x 11906 twips) -->
    <w:sectPr>
      <w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>
      <w:pgMar w:top="1000" w:right="1200" w:bottom="1000" w:left="1200" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>

  </w:body>
</w:document>';
$zip->addFromString('word/document.xml', $documentXml);

$zip->close();
echo "Successfully generated default Course Certificate template at:\n$templatePath\n";
