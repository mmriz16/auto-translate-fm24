'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

interface LTFEntry {
  key: string;
  english: string;
  indonesian: string;
  comment?: string;
}

export default function Home() {
  const [entries, setEntries] = useState<LTFEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [currentTranslatingIndex, setCurrentTranslatingIndex] = useState<number | null>(null);
  const [translationProgress, setTranslationProgress] = useState<{
    total: number;
    completed: number;
    current: string;
    startTime?: number;
  }>({ total: 0, completed: 0, current: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [statusMessage, setStatusMessage] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelTranslationRef = useRef(false);

  // Constants - Aggressively optimized for maximum speed
  const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB
  const LARGE_FILE_WARNING = 50 * 1024 * 1024; // 50MB
  const BATCH_SIZE = 100; // BATCH PROCESSING: 100 entries per API request for maximum efficiency
  const CONCURRENT_BATCHES = 5; // REDUCED: 5 concurrent batches since each batch is much larger
  const DELAY_BETWEEN_BATCH_GROUPS = 100; // INCREASED: 100ms delay for larger batches

  // Memoized calculations
  const untranslatedEntries = useMemo(() => {
    return entries.filter(entry => entry.english && !entry.indonesian.trim());
  }, [entries]);

  const untranslatedCount = useMemo(() => {
    return untranslatedEntries.length;
  }, [untranslatedEntries]);

  useEffect(() => {
    return () => {
      setStatusMessage('');
    };
  }, []);

  const handleIndonesianChange = useCallback((index: number, value: string) => {
    setEntries(prevEntries =>
      prevEntries.map((entry, i) =>
        i === index ? { ...entry, indonesian: value } : entry
      )
    );
  }, []);

  const estimateCost = useCallback((tokens: number) => {
    // GPT-4o pricing: $2.50 per 1M input tokens, $10.00 per 1M output tokens
    // Assuming roughly equal input/output for translation
    const inputCostPer1M = 2.50;
    const outputCostPer1M = 10.00;
    
    // Estimate input tokens (source text) and output tokens (translated text)
    const inputTokens = tokens;
    const outputTokens = tokens * 1.2; // Assume output is 20% longer
    
    const inputCost = (inputTokens / 1000000) * inputCostPer1M;
    const outputCost = (outputTokens / 1000000) * outputCostPer1M;
    const totalCost = inputCost + outputCost;
    
    return {
      inputTokens,
      outputTokens,
      totalCost: Math.max(totalCost, 0.01) // Minimum $0.01
    };
  }, []);

  const estimateTime = useCallback((remainingEntries: number) => {
    if (remainingEntries <= 0) return '0s';
    
    // OPTIMAL settings for best speed/stability balance
    const BATCH_SIZE = 20; // OPTIMAL: 20 entries per batch
    const CONCURRENT_BATCHES = 8; // OPTIMAL: 8 concurrent batches
    const baseTimePerEntry = 0.08; // REALISTIC: 80ms per entry
    const networkOverhead = 0.02; // REALISTIC OVERHEAD: 20ms
    const DELAY_BETWEEN_BATCH_GROUPS = 50; // MINIMAL: 50ms delay
    
    // Calculate effective time per entry considering parallelization
    const adjustedTimePerEntry = baseTimePerEntry + (networkOverhead / CONCURRENT_BATCHES);
    
    // Calculate total batches needed
    const totalBatches = Math.ceil(remainingEntries / BATCH_SIZE);
    
    // Calculate batch groups (how many groups of concurrent batches)
    const batchGroups = Math.ceil(totalBatches / CONCURRENT_BATCHES);
    
    // Calculate total time
    const processingTime = (remainingEntries * adjustedTimePerEntry);
    const delayTime = (batchGroups - 1) * (DELAY_BETWEEN_BATCH_GROUPS / 1000); // Convert to seconds
    const totalSeconds = processingTime + delayTime;
    
    // Debug logging
    console.log('ETA Calculation Debug (Ultra Optimized):', {
      remainingEntries,
      BATCH_SIZE,
      CONCURRENT_BATCHES,
      baseTimePerEntry,
      networkOverhead,
      adjustedTimePerEntry,
      totalBatches,
      batchGroups,
      processingTime,
      delayTime,
      totalSeconds,
      estimatedHours: (totalSeconds / 3600).toFixed(2)
    });
    
    if (totalSeconds < 60) {
      return `${Math.ceil(totalSeconds)}s`;
    } else if (totalSeconds < 3600) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = Math.ceil(totalSeconds % 60);
      return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  }, []);

  const cleanTextForTranslation = useCallback((text: string): { cleanText: string, placeholders: { [key: string]: string } } => {
    let cleanText = text;
    const placeholders: { [key: string]: string } = {};
    let placeholderIndex = 0;

    // Replace bracketed content with placeholders, preserving spacing
    cleanText = cleanText.replace(/\[[^\]]*\]/g, (match, offset) => {
      const placeholder = `__BRACKET_${placeholderIndex}__`;
      placeholders[placeholder] = match;
      placeholderIndex++;
      
      // Check if we need spaces around the placeholder
      const beforeChar = offset > 0 ? cleanText[offset - 1] : '';
      const afterChar = offset + match.length < cleanText.length ? cleanText[offset + match.length] : '';
      
      const needSpaceBefore = beforeChar && /[a-zA-Z0-9]/.test(beforeChar);
      const needSpaceAfter = afterChar && /[a-zA-Z0-9]/.test(afterChar);
      
      return (needSpaceBefore ? ' ' : '') + placeholder + (needSpaceAfter ? ' ' : '');
    });

    // Replace braced content with placeholders, preserving spacing
    cleanText = cleanText.replace(/\{[^}]*\}/g, (match, offset) => {
      const placeholder = `__BRACE_${placeholderIndex}__`;
      placeholders[placeholder] = match;
      placeholderIndex++;
      
      // Check if we need spaces around the placeholder
      const beforeChar = offset > 0 ? cleanText[offset - 1] : '';
      const afterChar = offset + match.length < cleanText.length ? cleanText[offset + match.length] : '';
      
      const needSpaceBefore = beforeChar && /[a-zA-Z0-9]/.test(beforeChar);
      const needSpaceAfter = afterChar && /[a-zA-Z0-9]/.test(afterChar);
      
      return (needSpaceBefore ? ' ' : '') + placeholder + (needSpaceAfter ? ' ' : '');
    });

    // Keep \n as they are important for formatting in FM24
    // Only clean up excessive spaces (but preserve single spaces and \n)
    cleanText = cleanText.replace(/[ \t]+/g, ' ').trim();

    return { cleanText, placeholders };
  }, []);

  const restorePlaceholders = useCallback((translatedText: string, placeholders: { [key: string]: string }): string => {
    let restoredText = translatedText;
    
    // Restore all placeholders
    Object.entries(placeholders).forEach(([placeholder, original]) => {
      restoredText = restoredText.replace(new RegExp(placeholder, 'g'), original);
    });
    
    // Clean up any excessive spacing that might have been introduced
    restoredText = restoredText.replace(/\s{3,}/g, ' ').trim();
    
    return restoredText;
  }, []);

  const cancelTranslation = useCallback(() => {
    setIsCancelling(true);
    cancelTranslationRef.current = true;
    setStatusMessage('Membatalkan translasi...');
  }, []);

  // New batch translation function for processing 100 entries at once
  const translateBatch = useCallback(async (batchEntries: Array<{entry: Entry, index: number}>) => {
    if (batchEntries.length === 0) return;

    try {
      // Prepare texts for batch processing
      const textsToTranslate = batchEntries.map(({entry}) => {
        const { cleanText } = cleanTextForTranslation(entry.english);
        return cleanText;
      });

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ texts: textsToTranslate }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.translatedTexts && Array.isArray(data.translatedTexts)) {
        // Process each translated text
        batchEntries.forEach(({entry, index}, i) => {
          if (i < data.translatedTexts.length) {
            const translatedText = data.translatedTexts[i];
            
            if (translatedText && translatedText.trim()) {
              // Check if the response is a rejection/error message
              if (isRejectionResponse(translatedText)) {
                // Use English text if AI rejected the translation
                setEntries(prevEntries =>
                  prevEntries.map((e, entryIndex) =>
                    entryIndex === index ? { ...e, indonesian: entry.english } : e
                  )
                );
              } else {
                // Restore placeholders in translated text
                const { placeholders } = cleanTextForTranslation(entry.english);
                const restoredText = restorePlaceholders(translatedText, placeholders);
                setEntries(prevEntries =>
                  prevEntries.map((e, entryIndex) =>
                    entryIndex === index ? { ...e, indonesian: restoredText } : e
                  )
                );
              }
            }
          }
        });

        // Update progress
        setTranslationProgress(prev => ({
          ...prev,
          completed: prev.completed + data.processedCount
        }));
      }
    } catch (error) {
      console.error('Batch translation error:', error);
      // Fallback to individual translation for this batch
      for (const {entry, index} of batchEntries) {
        try {
          await translateSingleEntry(entry, index);
        } catch (singleError) {
          console.error(`Failed to translate entry ${index}:`, singleError);
        }
      }
    }
  }, [entries, setEntries, setTranslationProgress]);

  // Helper function for single entry translation (fallback)
  const translateSingleEntry = useCallback(async (entry: Entry, index: number) => {
    const { cleanText, placeholders } = cleanTextForTranslation(entry.english);
    
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: cleanText }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.translatedText && data.translatedText.trim()) {
      if (isRejectionResponse(data.translatedText)) {
        setEntries(prevEntries =>
          prevEntries.map((e, i) =>
            i === index ? { ...e, indonesian: entry.english } : e
          )
        );
      } else {
        const restoredText = restorePlaceholders(data.translatedText, placeholders);
        setEntries(prevEntries =>
          prevEntries.map((e, i) =>
            i === index ? { ...e, indonesian: restoredText } : e
          )
        );
      }
    }
  }, [entries, setEntries]);

  const translateEntry = useCallback(async (index: number) => {
    const entry = entries[index];
    if (!entry.english || entry.indonesian.trim() !== '' || isTranslating) {
      return;
    }

    setCurrentTranslatingIndex(index);
    
    try {
      // Clean text and extract placeholders
      const { cleanText, placeholders } = cleanTextForTranslation(entry.english);
      
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: cleanText }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.translatedText && data.translatedText.trim()) {
        // Check if the response is a rejection/error message
        if (isRejectionResponse(data.translatedText)) {
          // Use English text if AI rejected the translation
          setEntries(prevEntries =>
            prevEntries.map((e, i) =>
              i === index ? { ...e, indonesian: entry.english } : e
            )
          );
        } else {
          // Restore placeholders in translated text
          const restoredText = restorePlaceholders(data.translatedText, placeholders);
          setEntries(prevEntries =>
            prevEntries.map((e, i) =>
              i === index ? { ...e, indonesian: restoredText } : e
            )
          );
        }
      } else {
        // Fallback: use English text if translation is empty or failed
        setEntries(prevEntries =>
          prevEntries.map((e, i) =>
            i === index ? { ...e, indonesian: entry.english } : e
          )
        );
      }
    } catch (error) {
      console.error('Translation error:', error);
      // Fallback: use English text if translation fails
      setEntries(prevEntries =>
        prevEntries.map((e, i) =>
          i === index ? { ...e, indonesian: entry.english } : e
        )
      );
      setStatusMessage(`Translation failed for ${entry.key}, using original text`);
    } finally {
      setCurrentTranslatingIndex(null);
    }
  }, [entries, isTranslating, cleanTextForTranslation, restorePlaceholders]);

  const translateAll = useCallback(async () => {
    if (isTranslating || untranslatedCount === 0) return;

    setIsTranslating(true);
    setIsCancelling(false);
    cancelTranslationRef.current = false;
    
    const entriesToTranslate = entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.english && !entry.indonesian.trim());

    setTranslationProgress({
      total: entriesToTranslate.length,
      completed: 0,
      current: 'Memulai translasi...',
      startTime: Date.now()
    });

    let completed = 0;

    try {
      // BATCH PROCESSING: 100 entries per batch with 5 concurrent batches (500 entries per group)
      const batchSize = 100;
      const concurrentBatches = 5;
      const entriesPerGroup = batchSize * concurrentBatches;

      for (let groupStart = 0; groupStart < entriesToTranslate.length; groupStart += entriesPerGroup) {
        if (cancelTranslationRef.current) {
          setStatusMessage('Translasi dibatalkan oleh user');
          break;
        }

        const groupEntries = entriesToTranslate.slice(groupStart, groupStart + entriesPerGroup);
        const batches = [];

        // Create batches of 100 entries each
        for (let i = 0; i < groupEntries.length; i += batchSize) {
          batches.push(groupEntries.slice(i, i + batchSize));
        }

        // Process batches concurrently using new batch translation
        const batchPromises = batches.map(async (batch) => {
          if (cancelTranslationRef.current) return;

          setTranslationProgress(prev => ({
            ...prev,
            current: `Menerjemahkan batch ${Math.floor(groupStart / batchSize) + 1} (${batch.length} entries)`
          }));

          await translateBatch(batch);
        });

        await Promise.all(batchPromises);
      }

      if (!cancelTranslationRef.current) {
        setStatusMessage(`Translasi selesai! ${translationProgress.completed} entries berhasil diterjemahkan.`);
      }

    } catch (error) {
      console.error('Translation process error:', error);
      setStatusMessage(`Error during translation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTranslating(false);
      setIsCancelling(false);
      setCurrentTranslatingIndex(null);
      cancelTranslationRef.current = false;
    }
  }, [entries, isTranslating, untranslatedCount, cleanTextForTranslation, restorePlaceholders]);

  const translateCurrentPage = useCallback(async () => {
    if (isTranslating) return;

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageEntries = entries.slice(startIndex, endIndex);
    
    const entriesToTranslate = pageEntries
      .map((entry, relativeIndex) => ({ 
        entry, 
        index: startIndex + relativeIndex 
      }))
      .filter(({ entry }) => entry.english && !entry.indonesian.trim());

    if (entriesToTranslate.length === 0) {
      setStatusMessage('Tidak ada entry yang perlu diterjemahkan di halaman ini');
      return;
    }

    setIsTranslating(true);
    setIsCancelling(false);
    cancelTranslationRef.current = false;

    setTranslationProgress({
      total: entriesToTranslate.length,
      completed: 0,
      current: 'Memulai translasi halaman...',
      startTime: Date.now()
    });

    try {
      // BATCH: 100 entries per batch with 3 concurrent batches (300 entries per group)
      const batchSize = 100;
      const concurrentBatches = 3;
      const entriesPerGroup = batchSize * concurrentBatches;

      for (let groupStart = 0; groupStart < entriesToTranslate.length; groupStart += entriesPerGroup) {
        if (cancelTranslationRef.current) {
          setStatusMessage('Translasi dibatalkan oleh user');
          break;
        }

        const groupEntries = entriesToTranslate.slice(groupStart, groupStart + entriesPerGroup);
        const batches = [];

        // Create batches
        for (let i = 0; i < groupEntries.length; i += batchSize) {
          batches.push(groupEntries.slice(i, i + batchSize));
        }

        // Process batches concurrently
        const batchPromises = batches.map(async (batch) => {
          if (cancelTranslationRef.current) return;

          setTranslationProgress(prev => ({
            ...prev,
            current: `Menerjemahkan batch ${batch.length} entries...`
          }));

          await translateBatch(batch);
        });

        await Promise.all(batchPromises);
      }

      if (!cancelTranslationRef.current) {
        setStatusMessage(`Translasi halaman selesai! ${translationProgress.completed} entries berhasil diterjemahkan.`);
      }

    } catch (error) {
      console.error('Translation process error:', error);
      setStatusMessage(`Error during translation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsTranslating(false);
      setIsCancelling(false);
      setCurrentTranslatingIndex(null);
      cancelTranslationRef.current = false;
    }
  }, [entries, isTranslating, currentPage, itemsPerPage, translateBatch]);

  const exportLTF = useCallback(() => {
    if (entries.length === 0) {
      alert('Tidak ada data untuk diekspor!');
      return;
    }

    try {
      let content = 'LANGNAME: Bahasa Indonesia\n';
      content += 'GENDERS: 0\n';
      content += 'BASESTRINGS: 0\n\n';

      const chunkSize = 1000;
      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        const chunkContent = chunk.map(entry => {
          // Reconstruct the original format with comment if it exists
          let englishText = entry.english;
          if (entry.comment) {
            englishText = `${entry.english}[COMMENT: ${entry.comment}]`;
          }
          
          return `${entry.key}: ${englishText}\nSTR-1: ${entry.indonesian || ''}\n`;
        }).join('\n');
        content += chunkContent;
        
        if (i % (chunkSize * 5) === 0) {
          // Allow UI to update every 5000 entries
          setTimeout(() => {}, 0);
        }
      }

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName.replace('.ltf', '_translated.ltf') || 'translated.ltf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Error saat mengekspor file!');
    }
  }, [entries, fileName]);

  const estimateTokens = useCallback((inputEntries: LTFEntry[]) => {
    const entriesToProcess = inputEntries.filter(entry => 
      entry.english && !entry.indonesian.trim()
    );
    
    const totalWords = entriesToProcess.reduce((sum, entry) => {
      return sum + entry.english.split(' ').length;
    }, 0);
    
    // Rough estimate: 1 token ≈ 0.75 words for English
    // Add some overhead for system prompts and formatting
    const estimatedTokens = Math.ceil(totalWords / 0.75) + (entriesToProcess.length * 50);
    return estimatedTokens;
  }, []);

  const getCurrentPageEntries = useCallback(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return entries.slice(startIndex, startIndex + itemsPerPage);
  }, [entries, currentPage, itemsPerPage]);

  const parseLTFFile = async (content: string): Promise<LTFEntry[]> => {
    const lines = content.split('\n');
    const parsedEntries: LTFEntry[] = [];
    
    let currentKey = '';
    let currentEnglish = '';
    let currentComment = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip header lines and empty lines
      if (!line || line.startsWith('LANGNAME:') || line.startsWith('GENDERS:') || line.startsWith('BASESTRINGS:')) {
        continue;
      }
      
      // Check for key-value pattern: "key: english_text"
      const keyValueMatch = line.match(/^([^:]+):\s*(.+)$/);
      if (keyValueMatch && !line.startsWith('STR-')) {
        currentKey = keyValueMatch[1].trim();
        const fullText = keyValueMatch[2].trim();
        
        // Check if there's a comment in the text
        const commentMatch = fullText.match(/^(.*?)\[COMMENT:\s*(.*?)\](.*)$/);
        if (commentMatch) {
          // Text has comment - separate them
          const beforeComment = commentMatch[1].trim();
          const commentText = commentMatch[2].trim();
          const afterComment = commentMatch[3].trim();
          
          // Combine text parts (before and after comment)
          currentEnglish = (beforeComment + ' ' + afterComment).trim();
          currentComment = commentText;
        } else {
          // No comment found
          currentEnglish = fullText;
          currentComment = '';
        }
        continue;
      }
      
      // Check for translation line: "STR-1: indonesian_text"
      if (line.startsWith('STR-1:') && currentKey && currentEnglish) {
        const strMatch = line.match(/STR-1:\s*(.*)/);
        const indonesian = strMatch ? strMatch[1].trim() : '';
        
        parsedEntries.push({
          key: currentKey,
          english: currentEnglish,
          indonesian: indonesian,
          comment: currentComment || undefined
        });
        
        // Reset for next entry
        currentKey = '';
        currentEnglish = '';
        currentComment = '';
      }
      
      // Performance optimization: yield control every 1000 lines
      if (i % 1000 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return parsedEntries;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert(`File terlalu besar! Maksimal ukuran file adalah ${MAX_FILE_SIZE / (1024 * 1024)}MB. File Anda: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (file.size > LARGE_FILE_WARNING) {
      const proceed = confirm(`File cukup besar (${(file.size / (1024 * 1024)).toFixed(2)}MB). Proses parsing mungkin memakan waktu lama. Lanjutkan?`);
      if (!proceed) {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
    }

    setIsUploading(true);
    setUploadProgress(0);
    setFileName(file.name);
    setStatusMessage('Memulai upload file...');

    try {
      for (let i = 0; i <= 30; i += 10) {
        setUploadProgress(i);
        setStatusMessage(`Membaca file... ${i}%`);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const reader = new FileReader();
      
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 70) + 30;
          setUploadProgress(progress);
          setStatusMessage(`Memuat file... ${progress}%`);
        }
      };

      reader.onload = async (e) => {
        const content = e.target?.result as string;
        
        setUploadProgress(90);
        setStatusMessage('Parsing file .ltf...');
        
        setTimeout(async () => {
          try {
            const parsedEntries = await parseLTFFile(content);
            
            setEntries(parsedEntries);
            setCurrentPage(1);
            setUploadProgress(100);
            
            setTimeout(() => {
              setStatusMessage(`Berhasil memuat ${parsedEntries.length} entri terjemahan`);
              setIsUploading(false);
              setUploadProgress(0);
              
              setTimeout(() => {
                setStatusMessage('');
              }, 3000);
            }, 500);
          } catch (parseError) {
            console.error('Error parsing file:', parseError);
            setStatusMessage('Error: Gagal parsing file .ltf');
            setIsUploading(false);
            setUploadProgress(0);
          }
        }, 100);
      };

      reader.onerror = () => {
        setStatusMessage('Error: Gagal membaca file');
        setIsUploading(false);
        setUploadProgress(0);
      };

      reader.readAsText(file);
    } catch (error) {
      setStatusMessage('Error: Gagal memproses file');
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Function to check if AI response is a rejection
  const isRejectionResponse = (text: string): boolean => {
    const rejectionKeywords = [
      // Indonesian rejection phrases
      'tidak dapat menerjemahkan',
      'tidak bisa menerjemahkan', 
      'maaf',
      'tidak lengkap',
      'tidak jelas',
      'berikan konteks',
      'kalimat yang lebih lengkap',
      'silakan berikan',
      'tidak memahami',
      'kurang jelas',
      'tidak dapat membantu',
      'saya tidak dapat membantu',
      'dengan permintaan tersebut',
      'permintaan tersebut',
      // English rejection phrases - comprehensive coverage
      'i\'m sorry',
      'i am sorry',
      'sorry',
      'apologize',
      'i apologize',
      'i can\'t',
      'i cannot',
      'can\'t',
      'cannot',
      'unable',
      'not able',
      'i\'m unable',
      'i am unable',
      'i don\'t',
      'i do not',
      'don\'t',
      'do not',
      'won\'t',
      'will not',
      'i won\'t',
      'i will not',
      'assist with',
      'help with',
      'only assist',
      'can only',
      'only help',
      'only translate',
      'only work with',
      'from english to',
      'english to indonesian',
      'provide it',
      'please provide',
      'if you have',
      'happy to help',
      'glad to help',
      'be happy',
      'be glad',
      'i\'ll be',
      'i will be',
      'need more',
      'more context',
      'more information',
      'additional context',
      'unclear',
      'not clear',
      'incomplete',
      'not complete',
      'insufficient',
      'not enough',
      'understand what',
      'what you\'re',
      'you\'re asking',
      'asking for',
      'request',
      'your request',
      'this request',
      'that request'
    ];
    
    const lowerText = text.toLowerCase();
    
    // Check for rejection keywords
    const hasRejectionKeyword = rejectionKeywords.some(keyword => lowerText.includes(keyword));
    
    // Additional pattern checks for common rejection structures
    const rejectionPatterns = [
      /i'm sorry.*but/i,
      /sorry.*but/i,
      /i can't.*because/i,
      /i cannot.*because/i,
      /unable to.*because/i,
      /i don't.*understand/i,
      /i do not.*understand/i,
      /please.*provide/i,
      /if you.*have/i,
      /need.*more/i,
      /not.*clear/i,
      /not.*enough/i,
      /only.*assist/i,
      /only.*help/i,
      /only.*translate/i
    ];
    
    const hasRejectionPattern = rejectionPatterns.some(pattern => pattern.test(text));
    
    return hasRejectionKeyword || hasRejectionPattern;
  };

  return (
    <div className="w-full mx-auto">
      <div className="bg-white rounded-xl p-6 border border-[#e6e6e6]">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            🏆 FM Translator
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Auto Translator FM24
          </p>
            
            {/* File Upload Section */}
            <div className="mb-6">
              <input
                ref={fileInputRef}
                type="file"
                accept=".ltf"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <div className="cursor-pointer inline-flex items-center px-6 py-3 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <span className="text-blue-600 font-medium">
                    {isUploading ? 'Memproses...' : 'Pilih File .ltf'}
                  </span>
                </div>
              </label>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="mb-4">
                <div className="bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600">Upload Progress: {uploadProgress}%</p>
              </div>
            )}

            {/* Status Message */}
            {statusMessage && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-700 font-medium">{statusMessage}</p>
              </div>
            )}

            {/* File Info and Statistics */}
            {entries.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">{entries.length}</div>
                  <div className="text-sm text-blue-700">Total Entries</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="text-2xl font-bold text-green-600">
                    {entries.filter(entry => entry.indonesian.trim()).length}
                  </div>
                  <div className="text-sm text-green-700">Translated</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                  <div className="text-2xl font-bold text-orange-600">{untranslatedCount}</div>
                  <div className="text-sm text-orange-700">Remaining</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round((entries.filter(entry => entry.indonesian.trim()).length / entries.length) * 100)}%
                  </div>
                  <div className="text-sm text-purple-700">Progress</div>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {entries.length > 0 && (
              <div className="mb-6">
                <div className="bg-gray-200 rounded-full h-3 mb-2">
                  <div 
                    className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${(entries.filter(entry => entry.indonesian.trim()).length / entries.length) * 100}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600">
                  Overall Progress: {entries.filter(entry => entry.indonesian.trim()).length}/{entries.length} entries completed
                </p>
              </div>
            )}
          </div>

          {/* Translation Progress */}
          {isTranslating && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              {/* Main Progress Bar */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-yellow-800">Translation Progress</span>
                <span className="text-sm text-yellow-700">
                  {translationProgress.total > 0
                    ? `${translationProgress.completed}/${translationProgress.total} (${Math.round((translationProgress.completed / translationProgress.total) * 100)}%)`
                    : '0%'
                  }
                </span>
              </div>
              <div className="bg-yellow-200 rounded-full h-3 mb-3">
                <div 
                  className="bg-yellow-600 h-3 rounded-full transition-all duration-300"
                  style={{ 
                    width: translationProgress.total > 0 
                      ? `${(translationProgress.completed / translationProgress.total) * 100}%` 
                      : '0%' 
                  }}
                ></div>
              </div>

              {/* Batch Processing Indicator */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-yellow-800">Batch Processing</span>
                  <span className="text-xs text-yellow-600">100 entries per batch</span>
                </div>
                <div className="bg-blue-100 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500 animate-pulse"
                    style={{ 
                      width: translationProgress.total > 0 
                        ? `${Math.min(100, (translationProgress.completed % 100) * 1)}%` 
                        : '0%' 
                    }}
                  ></div>
                </div>
              </div>

              {/* Speed Indicator */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-yellow-800">Processing Speed</span>
                  <span className="text-xs text-yellow-600">
                    {translationProgress.completed > 0 
                      ? `~${Math.round(translationProgress.completed / Math.max(1, (Date.now() - (translationProgress.startTime || Date.now())) / 60000))} entries/min`
                      : 'Calculating...'
                    }
                  </span>
                </div>
                <div className="bg-green-100 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: translationProgress.completed > 0 ? '75%' : '0%'
                    }}
                  ></div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-yellow-700">
                  <div className="truncate">{translationProgress.current || 'Memulai...'}</div>
                </div>
                <div className="text-sm text-yellow-700">
                  ETA: {translationProgress.total > 0 && translationProgress.completed > 0
                    ? estimateTime(translationProgress.total - translationProgress.completed)
                    : 'Menghitung...'
                  }
                </div>
              </div>
            </div>
          )}

          {/* Cancel Translation Button */}
          {translationProgress.completed > 0 && (
            <div className="mb-6 text-center">
              <button
                onClick={cancelTranslation}
                disabled={isCancelling}
                className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                  isCancelling 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-500 hover:bg-red-600 text-white hover:shadow-lg transform hover:scale-105'
                }`}
              >
                {isCancelling ? 'Membatalkan...' : 'Batalkan Terjemahan'}
              </button>
            </div>
          )}

          {/* Pagination Controls - Top */}
          {entries.length > 0 && (
            <div className="mb-6">
              {Math.ceil(entries.length / itemsPerPage) > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Page:</span>
                    <div className="flex items-center space-x-1">
                      {/* Previous Button */}
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="w-10 h-10 flex items-center justify-center border rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed border-gray-300 hover:bg-gray-50 text-gray-700"
                      >
                        ←
                      </button>

                      {/* Page Numbers */}
                      {(() => {
                        const totalPages = Math.ceil(entries.length / itemsPerPage);
                        const maxVisiblePages = 5;
                        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                        
                        // Adjust start page if we're near the end
                        if (endPage - startPage + 1 < maxVisiblePages) {
                          startPage = Math.max(1, endPage - maxVisiblePages + 1);
                        }
                        
                        const pages = [];
                        
                        // First page + ellipsis
                        if (startPage > 1) {
                          pages.push(
                            <button
                              key={1}
                              onClick={() => setCurrentPage(1)}
                              className="w-10 h-10 flex items-center justify-center border rounded-lg transition-colors font-medium border-gray-300 hover:bg-gray-50 text-gray-700"
                            >
                              1
                            </button>
                          );
                          if (startPage > 2) {
                            pages.push(
                              <span key="ellipsis1" className="px-2 text-gray-500">...</span>
                            );
                          }
                        }
                        
                        // Visible page range
                        for (let i = startPage; i <= endPage; i++) {
                          pages.push(
                            <button
                              key={i}
                              onClick={() => setCurrentPage(i)}
                              className={`w-10 h-10 flex items-center justify-center border rounded-lg transition-colors font-medium ${
                                currentPage === i
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                  : 'border-gray-300 hover:bg-gray-50 text-gray-700 hover:text-gray-900'
                              }`}
                            >
                              {i}
                            </button>
                          );
                        }
                        
                        // Ellipsis + last page
                        if (endPage < totalPages) {
                          if (endPage < totalPages - 1) {
                            pages.push(
                              <span key="ellipsis2" className="px-2 text-gray-500">...</span>
                            );
                          }
                          pages.push(
                            <button
                              key={totalPages}
                              onClick={() => setCurrentPage(totalPages)}
                              className="w-10 h-10 flex items-center justify-center border rounded-lg transition-colors font-medium border-gray-300 hover:bg-gray-50 text-gray-700"
                            >
                              {totalPages}
                            </button>
                          );
                        }
                        
                        return pages;
                      })()}

                      {/* Next Button */}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(entries.length / itemsPerPage), prev + 1))}
                        disabled={currentPage === Math.ceil(entries.length / itemsPerPage)}
                        className="w-10 h-10 flex items-center justify-center border rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed border-gray-300 hover:bg-gray-50 text-gray-700"
                      >
                        →
                      </button>
                    </div>
                  </div>

                  {/* Direct Page Input */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Go to:</span>
                    <input
                      type="number"
                      min="1"
                      max={Math.ceil(entries.length / itemsPerPage)}
                      value={currentPage}
                      onChange={(e) => {
                        const page = parseInt(e.target.value);
                        if (page >= 1 && page <= Math.ceil(entries.length / itemsPerPage)) {
                          setCurrentPage(page);
                        }
                      }}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                    />
                    <span className="text-sm text-gray-600">of {Math.ceil(entries.length / itemsPerPage)}</span>
                  </div>

                  {/* Items per page selector */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Show:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(parseInt(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 border border-gray-300 rounded text-sm"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                    <span className="text-sm text-gray-600">per page</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {entries.length > 0 && (
            <div className="flex flex-wrap gap-4 justify-center mb-6">
              <button
                onClick={translateAll}
                disabled={isTranslating || untranslatedCount === 0}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  isTranslating || untranslatedCount === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isTranslating ? 'Menerjemahkan...' : 'Translate All'}
              </button>
              <button
                onClick={translateCurrentPage}
                disabled={isTranslating}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  isTranslating
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isTranslating ? 'Menerjemahkan...' : `Translate Page ${currentPage}`}
              </button>
              <button
                onClick={exportLTF}
                disabled={isTranslating}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  isTranslating
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                Export LTF
              </button>
            </div>
          )}

          {/* Entries Table */}
          {entries.length > 0 && (
            <div className="overflow-x-auto">
              <div className="min-w-full">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700 w-auto min-w-fit">Key</th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700 w-1/3">English</th>
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold text-gray-700 w-1/3">Indonesian</th>
                      <th className="border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700 w-auto min-w-fit">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries
                      .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                      .map((entry, index) => {
                        const actualIndex = (currentPage - 1) * itemsPerPage + index;
                        return (
                          <tr 
                            key={actualIndex} 
                            className={`hover:bg-gray-50 ${
                              currentTranslatingIndex === actualIndex ? 'bg-yellow-100 border-yellow-300' : ''
                            }`}
                          >
                            <td className="border border-gray-300 px-4 py-2 font-mono text-sm relative text-gray-800 w-auto min-w-fit">
                              {entry.key}
                              {currentTranslatingIndex === actualIndex && (
                                <div className="absolute right-2 top-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                                </div>
                              )}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-sm text-gray-800 w-1/3">
                              <div className="break-words">{entry.english}</div>
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-sm w-1/3">
                              <textarea
                                value={entry.indonesian}
                                onChange={(e) => handleIndonesianChange(actualIndex, e.target.value)}
                                className="w-full min-h-[60px] p-2 border border-gray-200 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                                placeholder="Indonesian translation..."
                              />
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center w-auto min-w-fit">
                              <button
                                onClick={() => translateEntry(actualIndex)}
                                disabled={isTranslating || !entry.english || entry.indonesian.trim() !== ''}
                                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                                  isTranslating || !entry.english || entry.indonesian.trim() !== ''
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-blue-500 text-white hover:bg-blue-600'
                                  }`}
                                title={
                                  !entry.english 
                                    ? 'Tidak ada teks English' 
                                    : entry.indonesian.trim() !== '' 
                                    ? 'Sudah diterjemahkan' 
                                    : 'Translate entry ini'
                                }
                              >
                                {currentTranslatingIndex === actualIndex ? (
                                  <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                                    Translating...
                                  </div>
                                ) : (
                                  'Translate'
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {entries.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              Upload a .ltf file to start translating
            </div>
          )}
        </div>
      </div>
  );
}