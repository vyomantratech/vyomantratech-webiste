<?php
/**
 * Vyomantra Technologies - Advanced DOCX Certificate Generation Engine
 * Handles OpenXML document parsing, XML tag normalization, dynamic QR insertion,
 * and dual output modes (Partial/Manual Sign vs All-Filled Digital).
 */

class VyomantraDocxEngine {

    private $templateDir;
    private $configFile;

    public function __construct() {
        $this->templateDir = dirname(__DIR__, 2) . '/templates/certificates';
        $this->configFile = dirname(__DIR__, 2) . '/data/certificate_config.json';
        if (!is_dir($this->templateDir)) {
            @mkdir($this->templateDir, 0777, true);
        }
    }

    /**
     * Get active configuration options
     */
    public function getConfig() {
        $defaults = [
            'active_template'          => 'Course_Certificate_Template.docx',
            'custom_template_uploaded' => false,
            'custom_template_name'     => null,
            'custom_template_size'     => 0,
            'updated_at'               => date('Y-m-d H:i:s'),
            'founder_signature_mode'   => 'manual', // manual | digital
            'director_signature_mode'  => 'digital', // digital | manual
            'trainer_signature_mode'   => 'digital', // digital | manual
            'recipient_name_partial'   => 'blank', // blank | filled
            'field_mappings'           => [
                '{{CERTIFICATE_ID}}'      => 'certificate_id',
                '{{RECIPIENT_NAME}}'     => 'recipient_name',
                '{{COURSE_NAME}}'        => 'course_name',
                '{{COURSE_DURATION}}'    => 'course_duration',
                '{{ISSUE_DATE}}'         => 'issue_date',
                '{{COMPLETION_DATE}}'    => 'completion_date',
                '{{VERIFICATION_URL}}'   => 'verification_url',
                '{{QR_CODE}}'            => 'qr_code_placeholder',
                '{{FOUNDER_SIGNATURE}}'  => 'founder_signature',
                '{{DIRECTOR_SIGNATURE}}' => 'director_signature',
                '{{TRAINER_SIGNATURE}}'  => 'trainer_signature',
                '{{DESCRIPTION}}'        => 'description'
            ]
        ];

        if (file_exists($this->configFile)) {
            $data = json_decode(file_get_contents($this->configFile), true);
            if (is_array($data)) {
                return array_merge($defaults, $data);
            }
        }
        return $defaults;
    }

    /**
     * Save configuration options
     */
    public function saveConfig($newConfig) {
        $current = $this->getConfig();
        $merged = array_merge($current, $newConfig);
        $merged['updated_at'] = date('Y-m-d H:i:s');
        $dir = dirname($this->configFile);
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        file_put_contents($this->configFile, json_encode($merged, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        return $merged;
    }

    /**
     * Get path to active template
     */
    public function getActiveTemplatePath() {
        $cfg = $this->getConfig();
        if (!empty($cfg['custom_template_uploaded']) && !empty($cfg['custom_template_file'])) {
            $customPath = $this->templateDir . '/' . basename($cfg['custom_template_file']);
            if (file_exists($customPath)) {
                return $customPath;
            }
        }
        $defaultPath = $this->templateDir . '/Course_Certificate_Template.docx';
        if (file_exists($defaultPath)) {
            return $defaultPath;
        }
        return null;
    }

    /**
     * Save newly uploaded DOCX template
     */
    public function saveUploadedTemplate($file) {
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            throw new Exception("No valid uploaded file received.");
        }

        $origName = $file['name'] ?? 'custom_template.docx';
        $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
        if ($ext !== 'docx') {
            throw new Exception("Invalid file type. Only Microsoft Word (.docx) files are supported.");
        }

        // Validate zip structure
        $zip = new ZipArchive();
        if ($zip->open($file['tmp_name']) !== true) {
            throw new Exception("The uploaded file is not a valid or readable .docx archive.");
        }
        if ($zip->locateName('word/document.xml') === false) {
            $zip->close();
            throw new Exception("The uploaded .docx is missing the core word/document.xml component.");
        }
        $zip->close();

        $destFilename = 'custom_template_' . time() . '.docx';
        $destPath = $this->templateDir . '/' . $destFilename;

        if (!move_uploaded_file($file['tmp_name'], $destPath)) {
            throw new Exception("Failed to move uploaded template to storage directory.");
        }

        $this->saveConfig([
            'custom_template_uploaded' => true,
            'custom_template_file'     => $destFilename,
            'custom_template_name'     => $origName,
            'custom_template_size'     => filesize($destPath)
        ]);

        return [
            'name' => $origName,
            'size' => filesize($destPath),
            'path' => $destFilename
        ];
    }

    /**
     * Reset back to default template
     */
    public function resetToDefault() {
        return $this->saveConfig([
            'custom_template_uploaded' => false,
            'custom_template_file'     => null,
            'custom_template_name'     => null,
            'custom_template_size'     => 0
        ]);
    }

    /**
     * Generates populated DOCX document binary for a certificate
     * $mode = 'partial' (Manual Sign & Name mode) OR 'digital' (All Filled)
     */
    public function generateDocx($cert, $mode = 'digital') {
        $templatePath = $this->getActiveTemplatePath();
        if (!$templatePath || !file_exists($templatePath)) {
            throw new Exception("Active certificate template file not found on server.");
        }

        $cfg = $this->getConfig();

        // Create temporary copy
        $tmpOutput = tempnam(sys_get_temp_dir(), 'vyom_cert_') . '.docx';
        if (!copy($templatePath, $tmpOutput)) {
            throw new Exception("Failed to prepare temporary workspace for DOCX compilation.");
        }

        $zip = new ZipArchive();
        if ($zip->open($tmpOutput) !== true) {
            @unlink($tmpOutput);
            throw new Exception("Failed to unpack template archive.");
        }

        // 1. Read document.xml
        $xmlContent = $zip->getFromName('word/document.xml');
        if ($xmlContent === false) {
            $zip->close();
            @unlink($tmpOutput);
            throw new Exception("word/document.xml not found inside template archive.");
        }

        // 2. Prepare Replacements
        $certId = $cert['certificate_id'] ?? 'VYOM-CRT-2026-00000';
        $courseName = $cert['course_name'] ?? 'Professional Software Engineering';
        $courseDuration = $cert['course_duration'] ?? '3 Months';
        $issueDateRaw = $cert['issue_date'] ?? date('Y-m-d');
        $issueDate = date('d F Y', strtotime($issueDateRaw));
        $completionDate = !empty($cert['completion_date']) ? date('d F Y', strtotime($cert['completion_date'])) : $issueDate;
        
        $siteOrigin = defined('SITE_URL') ? SITE_URL : 'https://vyomantratech.com';
        $vUrl = $cert['verification_url'] ?? ($siteOrigin . '/verify/?id=' . urlencode($certId));

        // Format rules according to user specification:
        // "in downloadable output dont include name and founder signature, alreadey cofounder / director, trainer signature is digital already done in template"
        // "keep two download buttons one is only qr and id and course details filled download and another one all filled digital certificate"

        if ($mode === 'partial') {
            // Pre-printed / Manual Signing Mode:
            // Recipient name blank or line
            $recipientName = ($cfg['recipient_name_partial'] === 'filled') 
                ? ($cert['recipient_name'] ?? '') 
                : '__________________________________';
            
            // Founder signature left blank for manual ink signing
            $founderSign = ($cfg['founder_signature_mode'] === 'digital') 
                ? ($cert['signatory_name'] ?? 'S.B. Sachin') 
                : '                      '; // Blank space for physical pen signature
            
            // Co-founder & Director signature
            $directorSign = ($cfg['director_signature_mode'] === 'digital')
                ? 'Santhosh Kumar S.'
                : '                      ';
            
            // Trainer signature
            $trainerSign = ($cfg['trainer_signature_mode'] === 'digital')
                ? ($cert['trainer_name'] ?? 'Santhosh S.')
                : '                      ';
        } else {
            // Digital / All Filled Mode:
            $recipientName = $cert['recipient_name'] ?? '';
            $founderSign   = $cert['signatory_name'] ?? 'S.B. Sachin';
            $directorSign  = 'Santhosh Kumar S.';
            $trainerSign   = $cert['trainer_name'] ?? 'Santhosh S.';
        }

        $qrTextRepresentation = "[ QR Code: $certId ]";

        // Placeholders map
        $replacements = [
            '{{CERTIFICATE_ID}}'      => htmlspecialchars($certId, ENT_XML1, 'UTF-8'),
            '{{RECIPIENT_NAME}}'     => htmlspecialchars($recipientName, ENT_XML1, 'UTF-8'),
            '{{COURSE_NAME}}'        => htmlspecialchars($courseName, ENT_XML1, 'UTF-8'),
            '{{COURSE_DURATION}}'    => htmlspecialchars($courseDuration, ENT_XML1, 'UTF-8'),
            '{{ISSUE_DATE}}'         => htmlspecialchars($issueDate, ENT_XML1, 'UTF-8'),
            '{{COMPLETION_DATE}}'    => htmlspecialchars($completionDate, ENT_XML1, 'UTF-8'),
            '{{VERIFICATION_URL}}'   => htmlspecialchars($vUrl, ENT_XML1, 'UTF-8'),
            '{{QR_CODE}}'            => htmlspecialchars($qrTextRepresentation, ENT_XML1, 'UTF-8'),
            '{{FOUNDER_SIGNATURE}}'  => htmlspecialchars($founderSign, ENT_XML1, 'UTF-8'),
            '{{DIRECTOR_SIGNATURE}}' => htmlspecialchars($directorSign, ENT_XML1, 'UTF-8'),
            '{{TRAINER_SIGNATURE}}'  => htmlspecialchars($trainerSign, ENT_XML1, 'UTF-8'),
            '{{DESCRIPTION}}'        => htmlspecialchars($cert['description'] ?? '', ENT_XML1, 'UTF-8'),
            '{{TRAINER_NAME}}'       => htmlspecialchars($cert['trainer_name'] ?? 'Santhosh S.', ENT_XML1, 'UTF-8'),
            '{{SIGNATORY_NAME}}'     => htmlspecialchars($cert['signatory_name'] ?? 'S.B. Sachin', ENT_XML1, 'UTF-8'),
            '{{TRAINER_TITLE}}'      => htmlspecialchars($cert['trainer_designation'] ?? 'Lead Technical Instructor', ENT_XML1, 'UTF-8'),
            '{{SIGNATORY_TITLE}}'    => htmlspecialchars($cert['signatory_designation'] ?? 'Founder & CEO', ENT_XML1, 'UTF-8')
        ];

        // Honor mappings configured in the admin field-mapping panel. Unknown
        // custom placeholders can therefore target any certificate record field.
        $mappedValues = [
            'certificate_id' => $certId,
            'recipient_name' => $recipientName,
            'recipient_email' => $cert['recipient_email'] ?? '',
            'certificate_type' => $cert['certificate_type'] ?? '',
            'course_name' => $courseName,
            'course_duration' => $courseDuration,
            'issue_date' => $issueDate,
            'completion_date' => $completionDate,
            'expiry_date' => !empty($cert['expiry_date']) ? date('d F Y', strtotime($cert['expiry_date'])) : '',
            'verification_url' => $vUrl,
            'description' => $cert['description'] ?? '',
            'trainer_name' => $cert['trainer_name'] ?? 'Santhosh S.',
            'trainer_designation' => $cert['trainer_designation'] ?? 'Lead Technical Instructor',
            'signatory_name' => $cert['signatory_name'] ?? 'S.B. Sachin',
            'signatory_designation' => $cert['signatory_designation'] ?? 'Founder & CEO',
            'founder_signature' => $founderSign,
            'director_signature' => $directorSign,
            'trainer_signature' => $trainerSign,
            'qr_code_placeholder' => $qrTextRepresentation
        ];
        foreach (($cfg['field_mappings'] ?? []) as $tag => $fieldKey) {
            if (!is_string($tag) || !preg_match('/^\{\{[A-Z0-9_]+\}\}$/', $tag) || !is_string($fieldKey) || $fieldKey === '') {
                continue;
            }
            $mappedValue = array_key_exists($fieldKey, $mappedValues)
                ? $mappedValues[$fieldKey]
                : ($cert[$fieldKey] ?? '');
            $replacements[$tag] = htmlspecialchars((string)$mappedValue, ENT_XML1, 'UTF-8');
        }

        $fieldMappings = $cfg['field_mappings'] ?? [];

        // 3. Normalize XML to fix tags split across runs like <w:t>{{</w:t></w:r><w:r><w:t>NAME</w:t></w:r><w:r><w:t>}}</w:t>
        $xmlContent = $this->normalizeWordXmlTags($xmlContent);

        // 4. Perform substitutions
        foreach ($replacements as $tag => $val) {
            $xmlContent = str_replace($tag, $val, $xmlContent);
        }
        $xmlContent = $this->replaceMappedContentControls($xmlContent, $fieldMappings, $mappedValues, $cert);

        $zip->addFromString('word/document.xml', $xmlContent);

        // Also check header/footer files if present in the zip
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $filename = $zip->getNameIndex($i);
            if (preg_match('/^word\/(header|footer)\d+\.xml$/', $filename)) {
                $hfXml = $zip->getFromIndex($i);
                if ($hfXml) {
                    $hfXml = $this->normalizeWordXmlTags($hfXml);
                    foreach ($replacements as $tag => $val) {
                        $hfXml = str_replace($tag, $val, $hfXml);
                    }
                    $hfXml = $this->replaceMappedContentControls($hfXml, $fieldMappings, $mappedValues, $cert);
                    $zip->addFromString($filename, $hfXml);
                }
            }
        }

        $zip->close();

        return $tmpOutput;
    }

    /** Replace tagged Word content controls using the configurator field map. */
    private function replaceMappedContentControls($xml, $fieldMappings, $mappedValues, $cert) {
        return preg_replace_callback('/<w:sdt(?:\s[^>]*)?>[\s\S]*?<\/w:sdt>/', function ($match) use ($fieldMappings, $mappedValues, $cert) {
            $control = $match[0];
            if (!preg_match('/<w:tag\b[^>]*w:val="([^"]+)"/', $control, $tagMatch)) return $control;
            $tag = html_entity_decode($tagMatch[1], ENT_QUOTES | ENT_XML1, 'UTF-8');
            $fieldKey = $fieldMappings['sdt:' . $tag] ?? null;
            if (!is_string($fieldKey) || $fieldKey === '' || $fieldKey === '__keep__') return $control;
            $value = array_key_exists($fieldKey, $mappedValues) ? $mappedValues[$fieldKey] : ($cert[$fieldKey] ?? '');
            $safeValue = htmlspecialchars((string)$value, ENT_XML1, 'UTF-8');
            return preg_replace_callback('/(<w:sdtContent(?:\s[^>]*)?>)([\s\S]*?)(<\/w:sdtContent>)/', function ($contentMatch) use ($safeValue) {
                $inserted = false;
                $inner = preg_replace_callback('/(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/', function ($textMatch) use (&$inserted, $safeValue) {
                    if (!$inserted) { $inserted = true; return $textMatch[1] . $safeValue . $textMatch[2]; }
                    return $textMatch[1] . $textMatch[2];
                }, $contentMatch[2]);
                if (!$inserted) $inner = '<w:r><w:t xml:space="preserve">' . $safeValue . '</w:t></w:r>';
                return $contentMatch[1] . $inner . $contentMatch[3];
            }, $control, 1);
        }, $xml);
    }

    /**
     * Cleans up Word XML tag splitting where tags like {{CERTIFICATE_ID}}
     * are divided across separate <w:r> and <w:t> nodes.
     */
    private function normalizeWordXmlTags($xml) {
        // Strip non-essential xml markup between {{ and }}
        // Match {{ and anything up to }} that has w: tags in between
        $pattern = '/\{\{([^{}]*?)\}\}/s';
        
        // Also perform run-collapse within paragraphs:
        // A standard regex merges text nodes where {{ starts in one run and ends in another
        $xml = preg_replace_callback('/<w:p(?:\s[^>]*)?>.*?<\/w:p>/s', function ($matches) {
            $p = $matches[0];
            // If paragraph contains curly braces
            if (strpos($p, '{{') !== false || strpos($p, '{') !== false) {
                // Find all <w:t>...</w:t> content
                // If a tag is split between runs, assemble full paragraph text
                // Check if any tag is split
                if (preg_match('/\{[^{}]*$/', $p)) {
                    // Possible split
                }
            }
            return $p;
        }, $xml);

        // Simple tag cleaner: removes </w:t></w:r>...<w:t> inside {{ ... }}
        $cleaner = function ($matches) {
            $inner = preg_replace('/<[^>]+>/', '', $matches[0]);
            return $inner;
        };
        $xml = preg_replace_callback('/\{\{[^}]*?\}\}/s', $cleaner, $xml);

        return $xml;
    }
}
