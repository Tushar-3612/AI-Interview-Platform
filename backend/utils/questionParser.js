import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.standardFontDataUrl =
  new URL(
    "pdfjs-dist/standard_fonts/",
    import.meta.url
  ).toString();

// ============= PDF EXTRACTION FUNCTIONS =============

async function extractPDFText(buffer) {
    const uint8 = new Uint8Array(buffer);

    const pdf = await pdfjsLib.getDocument({
        data: uint8
    }).promise;

    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        
        // Better text extraction with spacing
        let lastY = null;
        let pageText = "";
        
        for (const item of content.items) {
            const y = item.transform[5];
            if (lastY !== null && Math.abs(y - lastY) > 5) {
                pageText += "\n";
            }
            pageText += item.str + " ";
            lastY = y;
        }
        
        text += pageText + "\n\n";
    }

    return text;
}

// ============= HELPER FUNCTIONS =============

function normalizeAnswer(answer, options) {
    if (!answer) return "";
    
    answer = answer.trim();
    
    // Check if answer is a letter (A, B, C, D) with or without punctuation
    const letterMatch = answer.match(/^([A-D])\s*[.)]?\s*$/i);
    if (letterMatch) {
        return letterMatch[1].toUpperCase();
    }
    
    // Check if answer is a number (1, 2, 3, 4)
    const numMatch = answer.match(/^([1-4])\s*[.)]?\s*$/);
    if (numMatch) {
        const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        return map[numMatch[1]];
    }
    
    // Try to match answer text with options
    if (options && options.length > 0) {
        const answerLower = answer.toLowerCase().trim();
        let bestMatch = '';
        let bestScore = 0;
        
        for (let i = 0; i < options.length; i++) {
            const optLower = options[i].toLowerCase().trim();
            
            // Exact match
            if (optLower === answerLower) {
                return String.fromCharCode(65 + i);
            }
            
            // Partial match
            if (optLower.includes(answerLower) || answerLower.includes(optLower)) {
                const score = Math.max(
                    optLower.length / answerLower.length,
                    answerLower.length / optLower.length
                );
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = String.fromCharCode(65 + i);
                }
            }
        }
        
        if (bestMatch && bestScore > 0.5) {
            return bestMatch;
        }
    }
    
    // Return as is if no match found
    return answer;
}

// ============= MAIN PDF PARSER =============

function parsePDF(text) {
    const questions = [];
    
    if (!text || text.trim().length < 20) {
        console.error("Text is empty or too short");
        return [];
    }
    
    // Clean text - normalize whitespace
    const cleanedText = text.replace(/\s+/g, ' ').trim();
    
    // ============ METHOD 1: Split by Question Patterns ============
    const questionPatterns = [
        /Q(?:ue(?:stion)?)?\.?\s*(\d+)[.)\s:-]+/gi,  // Q1., Q1, Question 1
        /(\d+)[.)\s:-]+\s*(?=[A-Z])/g,                // 1. 2) etc
        /Question\s*(\d+)/gi                          // Question 1
    ];
    
    let questionBlocks = [];
    
    // Try each pattern
    for (const pattern of questionPatterns) {
        const blocks = splitByPattern(cleanedText, pattern);
        if (blocks.length >= 2) {
            questionBlocks = blocks;
            console.log(`Found ${blocks.length} questions using pattern`);
            break;
        }
    }
    
    // If no blocks found, try splitting by Q number
    if (questionBlocks.length === 0) {
        const qMatches = cleanedText.match(/Q\d+/gi);
        if (qMatches && qMatches.length > 0) {
            const parts = cleanedText.split(/(?=Q\d+)/i);
            questionBlocks = parts.filter(p => /Q\d+/i.test(p));
            console.log(`Found ${questionBlocks.length} questions using Q split`);
        }
    }
    
    // If still no blocks, try number pattern
    if (questionBlocks.length === 0) {
        const parts = cleanedText.split(/(?=\d+\.\s+[A-Z])/);
        questionBlocks = parts.filter(p => /^\d+\./.test(p.trim()));
        console.log(`Found ${questionBlocks.length} questions using number pattern`);
    }
    
    // Parse each block
    for (const block of questionBlocks) {
        const parsed = parseQuestionBlock(block);
        if (parsed) {
            questions.push(parsed);
        }
    }
    
    console.log(`Successfully parsed ${questions.length} questions`);
    return questions;
}

function splitByPattern(text, pattern) {
    const blocks = [];
    let lastIndex = 0;
    let match;
    const tempPattern = new RegExp(pattern.source, pattern.flags);
    
    // Find all matches
    const matches = [];
    while ((match = tempPattern.exec(text)) !== null) {
        matches.push({
            index: match.index,
            length: match[0].length,
            value: match[0]
        });
    }
    
    // Split text into blocks
    for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index;
        const end = i < matches.length - 1 ? matches[i + 1].index : text.length;
        const block = text.substring(start, end).trim();
        if (block) {
            blocks.push(block);
        }
    }
    
    return blocks;
}

function parseQuestionBlock(block) {
    try {
        // Normalize block
        const cleanBlock = block.replace(/\s+/g, ' ').trim();
        
        // ============ Extract Question Text ============
        let questionText = '';
        
        // Method 1: Remove question number prefix
        let temp = cleanBlock;
        temp = temp.replace(/^(?:Q(?:ue(?:stion)?)?\.?\s*\d+[.)\s:-]+|\d+[.)\s:-]+)/i, '');
        
        // Method 2: Find text before first option
        const optionStart = temp.search(/[A-D]\s*[.)]\s/);
        if (optionStart > 0) {
            questionText = temp.substring(0, optionStart).trim();
        } else {
            // Try to split by options
            const parts = temp.split(/[A-D]\s*[.)]\s/);
            if (parts.length > 0) {
                questionText = parts[0].trim();
            }
        }
        
        // If question text is too long, it might contain options
        if (!questionText || questionText.length > 200) {
            const beforeOptions = cleanBlock.split(/[A-D]\s*[.)]\s/)[0];
            questionText = beforeOptions.replace(/^(?:Q(?:ue(?:stion)?)?\.?\s*\d+[.)\s:-]+|\d+[.)\s:-]+)/i, '').trim();
        }
        
        // ============ Extract Options ============
        const options = [];
        
        // Try different option patterns
        const optionPatterns = [
            /([A-D])\s*[.)]\s*([^A-D]*?)(?=\s*[A-D]\s*[.)]|Answer:|Ans:|Correct Answer:|$)/gi,
            /([A-D])\s*[.)\s]+\s*([^A-D]*?)(?=\s*[A-D]\s*[.)\s]+|Answer:|Ans:|$)/gi,
            /([A-D])\s*[-:]\s*([^A-D]*?)(?=\s*[A-D]\s*[-:]|Answer:|Ans:|$)/gi
        ];
        
        for (const pattern of optionPatterns) {
            const found = [];
            let match;
            const tempPattern = new RegExp(pattern.source, pattern.flags);
            
            while ((match = tempPattern.exec(cleanBlock)) !== null) {
                const optText = match[2].trim();
                if (optText && optText.length > 0) {
                    found.push(optText);
                }
            }
            
            if (found.length >= 4) {
                options.push(...found);
                break;
            }
        }
        
        // If options found with pattern, use them
        if (options.length === 0) {
            // Try inline options like "A. Option B. Option C. Option D. Option"
            const inlineMatch = cleanBlock.match(/([A-D])\s*[.)]\s*([^A-D]*?)(?=\s*[A-D]\s*[.)]|$)/gi);
            if (inlineMatch) {
                for (const opt of inlineMatch) {
                    const parts = opt.match(/([A-D])\s*[.)]\s*(.+)/);
                    if (parts) {
                        options.push(parts[2].trim());
                    }
                }
            }
        }
        
        // ============ Extract Answer ============
        let answerText = '';
        const answerPatterns = [
            /(?:Answer|Ans|Correct\s*Answer)\s*:?\s*([^Q]+?)(?=\s*(?:Q\d+|$))/i,
            /(?:Answer|Ans|Correct\s*Answer)\s*:?\s*(.+?)(?=\s*(?:Q\d+|$))/i,
            /Answer\s*[=-]\s*(.+?)(?=\s*(?:Q\d+|$))/i
        ];
        
        for (const pattern of answerPatterns) {
            const match = cleanBlock.match(pattern);
            if (match) {
                answerText = match[1].trim();
                break;
            }
        }
        
        // ============ Extract Metadata ============
        let marks = 1;
        let difficulty = 'medium';
        let subject = '';
        let explanation = '';
        
        // Marks
        const marksMatch = cleanBlock.match(/Marks?\s*:?\s*(\d+)/i);
        if (marksMatch) {
            marks = parseInt(marksMatch[1]) || 1;
        }
        
        // Difficulty
        const diffMatch = cleanBlock.match(/Difficulty\s*:?\s*(Easy|Medium|Hard)/i);
        if (diffMatch) {
            difficulty = diffMatch[1].toLowerCase();
        }
        
        // Subject
        const subMatch = cleanBlock.match(/Subject\s*:?\s*([^MarksDifficultyExplanation]+?)(?=\s*(?:Marks:|Difficulty:|Explanation:|$))/i);
        if (subMatch) {
            subject = subMatch[1].trim();
        }
        
        // Explanation
        const expMatch = cleanBlock.match(/(?:Explanation|Solution|Reason)\s*:?\s*([^MarksDifficultySubject]+?)(?=\s*(?:Marks:|Difficulty:|Subject:|$))/i);
        if (expMatch) {
            explanation = expMatch[1].trim();
        }
        
        // ============ Determine Correct Answer ============
        const correctAnswer = normalizeAnswer(answerText, options);
        
        // ============ Validate and Return ============
        if (questionText && options.length >= 4) {
            return {
                question: questionText,
                options: options.slice(0, 4),
                correctAnswer: correctAnswer,
                marks: marks,
                negativeMarks: 0,
                explanation: explanation,
                difficulty: difficulty,
                subject: subject,
            };
        } else if (questionText && options.length > 0) {
            // Partial - add with warning
            console.log("Partial question:", questionText.substring(0, 30), "Options:", options.length);
            return {
                question: questionText,
                options: options,
                correctAnswer: correctAnswer,
                marks: marks,
                negativeMarks: 0,
                explanation: explanation,
                difficulty: difficulty,
                subject: subject,
            };
        }
        
        return null;
    } catch (error) {
        console.error("Error parsing block:", error.message);
        return null;
    }
}

// ============= MAIN EXPORT FUNCTION =============

export async function parseQuestions(fileBuffer, mimeType) {
    // Remove any query parameters from mimeType
    mimeType = mimeType.split(';')[0].trim();
    
    // Get file extension from buffer
    const extension = getFileExtension(fileBuffer);
    
    // Only handle PDF files
    if (mimeType === "application/pdf" || mimeType.endsWith("/pdf") || extension === "pdf") {
        const text = await extractPDFText(fileBuffer);
        console.log("==========================");
        console.log(text);
        console.log("==========================");
        
        if (!text || !text.trim()) {
            throw new Error("Could not extract text from PDF. The file might be scanned or image-based.");
        }
        
        const questions = parsePDF(text);
        
        if (questions.length === 0) {
            throw new Error("No questions could be parsed from the PDF. Please ensure the PDF follows a standard format.");
        }
        
        return questions;
    }
    
    throw new Error(`Unsupported file type: ${mimeType}. Please upload PDF files only.`);
}

export function removeDuplicates(questions) {
    const seen = new Set();
    return questions.filter(q => {
        const key = (q.question || "").toLowerCase().trim();
        if (!key) return false;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function validateQuestions(questions) {
    const errors = [];
    const warnings = [];
    
    questions.forEach((q, i) => {
        const rowNum = i + 1;
        
        if (!q.question?.trim()) {
            errors.push(`Row ${rowNum}: Question text is required`);
        }
        
        if (q.options && q.options.length > 0 && !q.correctAnswer?.trim()) {
            errors.push(`Row ${rowNum}: Correct answer is required when options are provided`);
        }
        
        if (q.options && q.options.length < 4) {
            warnings.push(`Row ${rowNum}: Has fewer than 4 options (MCQ should have 4 options)`);
        }
        
        if (q.options && q.options.length > 0 && q.correctAnswer?.trim()) {
            const normalizedCorrect = q.correctAnswer.trim().toUpperCase();
            const optionLetters = ['A', 'B', 'C', 'D'];
            
            if (optionLetters.includes(normalizedCorrect)) {
                const index = optionLetters.indexOf(normalizedCorrect);
                if (index >= q.options.length) {
                    warnings.push(`Row ${rowNum}: Correct answer "${q.correctAnswer}" doesn't correspond to an existing option`);
                }
            } else {
                const matchesOption = q.options.some(opt => 
                    opt.toUpperCase().trim() === normalizedCorrect
                );
                if (!matchesOption) {
                    warnings.push(`Row ${rowNum}: Correct answer "${q.correctAnswer}" doesn't match any option text`);
                }
            }
        }
        
        if (q.marks < 0) {
            warnings.push(`Row ${rowNum}: Marks cannot be negative, setting to 0`);
            q.marks = 0;
        }
    });
    
    return { errors, warnings };
}

// Helper function to get file extension from buffer
export function getFileExtension(buffer) {
    const header = buffer.slice(0, 4);
    
    // PDF
    if (header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46) {
        return 'pdf';
    }
    
    return 'unknown';
}