'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

interface LTFEntry {
  key: string;
  english: string;
  indonesian: string;
}

export default function Home() {
  const [entries, setEntries] = useState<LTFEntry[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [translationProgress, setTranslationProgress] = useState<{
    total: number;
    completed: number;
    current: string;
  }>({ total: 0, completed: 0, current: '' });
  const [currentTranslatingIndex, setCurrentTranslatingIndex] = useState<number | null>(-1);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  const [isLargeFile, setIsLargeFile] = useState<boolean>(false);
  const [estimatedTokens, setEstimatedTokens] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelTranslationRef = useRef<boolean>(false);

  const MAX_FILE_SIZE = 150 * 1024 * 1024;
  const LARGE_FILE_WARNING = 10 * 1024 * 1024;

  // Memoized calculation for untranslated entries to optimize performance
  const untranslatedEntries = useMemo(() => {
    return entries.filter(entry => entry.english && !entry.indonesian.trim());
  }, [entries]);

  // Memoized calculation for untranslated entries count to optimize performance
  const untranslatedCount = useMemo(() => {
    return untranslatedEntries.length;
  }, [untranslatedEntries]);

  useEffect(() => {
    return () => {
      setEntries([]);
      setStatusMessage('');
      setCurrentTranslatingIndex(-1);
    };
  }, []);

  const handleIndonesianChange = useCallback((index: number, value: string) => {
    setEntries(prevEntries => 
      prevEntries.map((entry, i) => 
        i === index ? { ...entry, indonesian: value } : entry
      )
    );
  }, []);

  // Function to estimate cost based on tokens
  const estimateCost = useCallback((tokens: number) => {
    // GPT-4o-mini pricing: $0.15 per 1M input tokens, $0.60 per 1M output tokens
    // Assuming 60% input, 40% output for translation tasks
    const inputTokens = Math.ceil(tokens * 0.6);
    const outputTokens = Math.ceil(tokens * 0.4);
    
    const inputCostUSD = (inputTokens / 1000000) * 0.15;
    const outputCostUSD = (outputTokens / 1000000) * 0.60;
    const totalCostUSD = inputCostUSD + outputCostUSD;
    
    // Convert to IDR (assuming 1 USD = 15,000 IDR)
    const totalCostIDR = totalCostUSD * 15000;
    
    return {
      usd: totalCostUSD,
      idr: totalCostIDR
    };
  }, []);

  // Function to estimate translation time
  const estimateTime = useCallback((remainingEntries: number) => {
    // Updated estimation based on MAXIMUM concurrent batch processing:
    // - Batch size: 50 entries per request (Translate All) / 40 entries (Current Page)
    // - Concurrent batches: 8 batches simultaneously (Translate All) / 6 batches (Current Page)
    // - Time per batch: ~2-3 seconds (including API call + processing)
    // - No delay between batch groups (0ms)
    // - Processing: 400 entries per cycle (50×8) every ~3 seconds for Translate All
    // - Processing: 240 entries per cycle (40×6) every ~3 seconds for Current Page
    // - Average: ~0.0075 seconds per entry with maximum concurrent processing (400 entries/3 seconds)
    const avgTimePerEntry = 0.0075; // seconds per entry in maximum concurrent batch mode
    const totalSeconds = remainingEntries * avgTimePerEntry;
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    if (hours > 0) {
      return `${hours}j ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }, []);

  const cancelTranslation = useCallback(() => {
    setIsCancelling(true);
    cancelTranslationRef.current = true;
    setStatusMessage('Membatalkan translasi...');
  }, []);

  const exportLTF = useCallback(() => {
    if (entries.length === 0) {
      alert('Tidak ada data untuk diekspor!');
      return;
    }

    try {
      let content = 'LANGNAME: Bahasa Indonesia\n';
      content += 'GENDERS: 0\n';
      content += 'BASESTRINGS: 0\n\n';
      
      const chunkSize = 100;
      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize);
        const chunkContent = chunk.map(entry => 
          `${entry.key}: ${entry.english}\nSTR-1: ${entry.indonesian || ''}\n`
        ).join('\n');
        content += chunkContent;
        
        if (i % (chunkSize * 5) === 0) {
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
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
    } catch (error) {
      console.error('Export error:', error);
      alert('Error saat mengekspor file!');
    }
  }, [entries, fileName]);

  // Function to estimate tokens needed for translation
  const estimateTokens = useCallback((inputEntries: LTFEntry[]) => {
    // Use cached untranslated entries if processing all entries, otherwise filter the input
    const entriesToProcess = inputEntries === entries ? untranslatedEntries : inputEntries.filter(entry => entry.english && !entry.indonesian.trim());
    
    // Rough estimation: 1 word ≈ 1.3 tokens (including input + output)
    // Adding system prompt overhead (~50 tokens per request)
    const totalWords = entriesToProcess.reduce((sum, entry) => {
      return sum + entry.english.split(' ').length;
    }, 0);
    
    const estimatedInputTokens = Math.ceil(totalWords * 1.3);
    const estimatedOutputTokens = Math.ceil(totalWords * 1.5); // Indonesian might be longer
    const systemPromptTokens = entriesToProcess.length * 50; // System prompt per request
    
    return estimatedInputTokens + estimatedOutputTokens + systemPromptTokens;
  }, [entries, untranslatedEntries]);

  // Function to get entries for current page
  const getCurrentPageEntries = useCallback(() => {
    return entries.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [entries, currentPage, itemsPerPage]);

  // Function to clean text before translation
  const cleanTextForTranslation = useCallback((text: string): { cleanText: string, placeholders: { [key: string]: string } } => {
    let cleanText = text;
    const placeholders: { [key: string]: string } = {};
    let placeholderIndex = 0;

    // Remove leading/trailing \n characters
    cleanText = cleanText.replace(/^\\n+|\\n+$/g, '');
    
    // Replace content within [] with placeholders, adding spaces only when needed to separate from alphanumeric characters
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

    // Replace content within {} with placeholders, adding spaces only when needed to separate from alphanumeric characters
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

    // Remove \n that are part of the string (not line breaks)
    cleanText = cleanText.replace(/\\n/g, ' ');

    // Clean up multiple spaces and trim
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    return { cleanText, placeholders };
  }, []);

  // Function to restore placeholders in translated text
  const restorePlaceholders = useCallback((translatedText: string, placeholders: { [key: string]: string }): string => {
    let restoredText = translatedText;
    
    // Restore all placeholders exactly as they appear in the translated text
    Object.entries(placeholders).forEach(([placeholder, original]) => {
      // Simply replace placeholder with original content, no space manipulation
      restoredText = restoredText.replace(new RegExp(placeholder, 'g'), original);
    });

    // Only clean up excessive spaces (3 or more consecutive spaces)
    restoredText = restoredText.replace(/\s{3,}/g, ' ').trim();

    return restoredText;
  }, []);

  const parseLTFFile = async (content: string): Promise<LTFEntry[]> => {
    const lines = content.split('\n');
    const parsedEntries: LTFEntry[] = [];
    let currentKey = '';
    let currentEnglish = '';

    parsedEntries.length = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('KEY-')) {
        const keyMatch = line.match(/^(KEY-[^:]+):\s*(.*)$/);
        if (keyMatch) {
          currentKey = keyMatch[1];
          currentEnglish = keyMatch[2];
        }
      } else if (line.startsWith('STR-1:') && currentKey) {
        const strMatch = line.match(/^STR-1:\s*(.*)$/);
        const indonesian = strMatch ? strMatch[1] : '';
        
        parsedEntries.push({
          key: currentKey,
          english: currentEnglish,
          indonesian: indonesian
        });
        
        currentKey = '';
        currentEnglish = '';
      }

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
      setIsLargeFile(true);
    } else {
      setIsLargeFile(false);
    }

    setIsUploading(true);
    setUploadProgress(0);
    setStatusMessage('Memulai upload file...');
    setFileName(file.name);
    setCurrentPage(1);

    try {
      for (let i = 0; i <= 30; i += 10) {
        setUploadProgress(i);
        setStatusMessage(`Membaca file... ${i}%`);
        await new Promise(resolve => setTimeout(resolve, 10)); // Reduced from 100ms to 10ms
      }

      const reader = new FileReader();
      
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = 30 + Math.round((e.loaded / e.total) * 40);
          setUploadProgress(progress);
          setStatusMessage(`Memuat file... ${progress}%`);
        }
      };

      reader.onload = async (e) => {
        setUploadProgress(70);
        setStatusMessage('Parsing file .ltf...');
        
        const content = e.target?.result as string;
        
        setTimeout(async () => {
          try {
            await new Promise(resolve => setTimeout(resolve, 100)); // Reduced from 500ms to 100ms
            setUploadProgress(90);
            setStatusMessage('Menganalisis struktur file...');
            
            const parsedEntries = await parseLTFFile(content);
            
            await new Promise(resolve => setTimeout(resolve, 50)); // Reduced from 300ms to 50ms
            setUploadProgress(100);
            setStatusMessage(`Berhasil memuat ${parsedEntries.length} entri terjemahan`);
            
            setEntries(parsedEntries);
            
            // Calculate estimated tokens
            const tokens = estimateTokens(parsedEntries);
            setEstimatedTokens(tokens);
            
            setTimeout(() => {
              setStatusMessage('');
              setIsUploading(false);
              setUploadProgress(0);
            }, 2000);
            
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
      // English rejection phrases
      'sorry, i can\'t assist',
      'i can\'t assist',
      'cannot assist',
      'unable to translate',
      'can\'t translate',
      'cannot translate',
      'i cannot',
      'i can\'t',
      'sorry, i cannot',
      'i\'m unable to',
      'i am unable to',
      'not able to translate',
      'insufficient context',
      'need more context',
      'unclear text',
      'incomplete text'
    ];
    
    const lowerText = text.toLowerCase();
    return rejectionKeywords.some(keyword => lowerText.includes(keyword));
  };

  // Function to translate with retry mechanism
  const translateWithRetry = async (text: string, maxRetries: number = 2): Promise<string> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        let requestText = text;
        
        // Use more explicit prompt for retry attempts
        if (attempt > 1) {
          requestText = `TRANSLATE TO INDONESIAN ONLY. Do not refuse, do not explain, just translate this text: "${text}"`;
        }
        
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: requestText }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error);
        }

        const translatedText = data.translatedText || '';
        
        // Check if AI rejected the translation
        if (isRejectionResponse(translatedText)) {
          console.log(`Attempt ${attempt}: AI rejected translation for "${text}"`);
          
          if (attempt < maxRetries) {
            console.log(`Retrying with more explicit prompt...`);
            continue;
          } else {
            console.log(`All attempts failed, using original text: "${text}"`);
            return text; // Return original text as fallback
          }
        }
        
        return translatedText;
        
      } catch (error) {
        console.error(`Translation attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          console.log(`All translation attempts failed, using original text: "${text}"`);
          return text; // Return original text as fallback
        }
      }
    }
    
    return text; // Fallback to original text
  };

  // Function to translate single entry
  const translateSingle = async (index: number) => {
    if (isTranslating) return;
    
    const entry = entries[index];
    if (!entry.english || entry.indonesian.trim()) {
      alert('Entry sudah diterjemahkan atau tidak ada teks English!');
      return;
    }

    setCurrentTranslatingIndex(index);
    setIsTranslating(true);

    try {
      const { cleanText, placeholders } = cleanTextForTranslation(entry.english);
      
      // Skip translation if text is empty after cleaning
      if (!cleanText.trim()) {
        alert('Tidak ada teks yang perlu diterjemahkan setelah filtering!');
        setIsTranslating(false);
        setCurrentTranslatingIndex(-1);
        return;
      }

      // Use retry mechanism
      const translatedText = await translateWithRetry(cleanText);

      // Restore placeholders in translated text
      const finalTranslation = restorePlaceholders(translatedText, placeholders);
      
      console.log('Single Translation result:', {
        originalText: entry.english,
        cleanText,
        translatedText,
        finalTranslation,
        index,
        entryKey: entry.key
      });

      // Create new entries array with updated translation
      const updatedEntries = [...entries];
      updatedEntries[index] = {
        ...entry,
        indonesian: finalTranslation
      };
      
      console.log('Before setEntries:', {
        oldEntry: entries[index],
        newEntry: updatedEntries[index],
        index,
        entriesLength: entries.length,
        updatedEntriesLength: updatedEntries.length
      });
      
      setEntries(updatedEntries);
      
      console.log('After setEntries called for index:', index);
      
      // Force re-render by updating a dummy state
      setEstimatedTokens(prev => prev);
      
      // Update estimated tokens after translation
      const updatedTokens = estimateTokens(updatedEntries);
      setEstimatedTokens(updatedTokens);

    } catch (error) {
      console.error(`Translation failed for ${entry.key}:`, error);
      alert(`Terjemahan gagal untuk ${entry.key}: ${error}`);
    } finally {
      setIsTranslating(false);
      setCurrentTranslatingIndex(-1);
    }
  };

  const translateText = async (text: string): Promise<string> => {
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Translation failed');
      }

      const data = await response.json();
      return data.translation;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  };

  const translateAll = async () => {
    if (isTranslating) return;
    
    const untranslatedEntries = entries
      .map((entry, index) => ({ ...entry, originalIndex: index }))
      .filter(entry => entry.english && !entry.indonesian.trim());

    if (untranslatedEntries.length === 0) {
      alert('Semua teks sudah diterjemahkan!');
      return;
    }

    setIsTranslating(true);
    setIsCancelling(false);
    cancelTranslationRef.current = false;
    // Set translation start time for speed calculation
    (window as any).translationStartTime = Date.now() / 1000;
    setTranslationProgress({
      total: untranslatedEntries.length,
      completed: 0,
      current: ''
    });

    const BATCH_SIZE = 50; // Increased from 30 to 50 for maximum throughput
    const CONCURRENT_BATCHES = 8; // Increased from 5 to 8 batches simultaneously
    const DELAY_BETWEEN_BATCH_GROUPS = 0; // Removed delay for maximum speed

    try {
      // Create a working copy of entries to avoid race conditions
      let workingEntries = [...entries];
      
      // Create all batches first
      const allBatches = [];
      for (let i = 0; i < untranslatedEntries.length; i += BATCH_SIZE) {
        allBatches.push(untranslatedEntries.slice(i, i + BATCH_SIZE));
      }

      // Process batches in concurrent groups
      for (let groupStart = 0; groupStart < allBatches.length; groupStart += CONCURRENT_BATCHES) {
        // Check if translation was cancelled
        if (cancelTranslationRef.current) {
          break;
        }
        
        const batchGroup = allBatches.slice(groupStart, groupStart + CONCURRENT_BATCHES);
        
        // Process multiple batches concurrently
        const groupPromises = batchGroup.map(async (batch) => {
        
        const batchPromises = batch.map(async (entry) => {
          // Check if translation was cancelled before processing each entry
          if (cancelTranslationRef.current) {
            return;
          }
          
          const { originalIndex } = entry;
          
          setTranslationProgress(prev => ({
            ...prev,
            current: `Menerjemahkan: ${entry.key}`
          }));

          try {
            const { cleanText, placeholders } = cleanTextForTranslation(entry.english);
            
            // Skip translation if text is empty after cleaning
            if (!cleanText.trim()) {
              return { success: true, index: originalIndex, skipped: true };
            }

            // Use translateWithRetry for better handling of AI rejections
            const translatedText = await translateWithRetry(cleanText);
            
            // Restore placeholders in translated text
            const finalTranslation = restorePlaceholders(translatedText, placeholders);
            
            console.log('Translation result:', {
              originalText: entry.english,
              cleanText,
              translatedText: translatedText,
              finalTranslation,
              originalIndex
            });

            return { 
              success: true, 
              index: originalIndex, 
              translation: finalTranslation,
              key: entry.key
            };
          } catch (error) {
            console.error(`Translation failed for ${entry.key}:`, error);
            return { success: false, index: originalIndex, error };
          }
        });

        // Wait for all promises in the batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Update working entries with successful translations
        batchResults.forEach(result => {
          if (result && result.success && result.translation) {
            workingEntries[result.index] = {
              ...workingEntries[result.index],
              indonesian: result.translation
            };
          }
        });
        
        return batchResults;
      });

      // Wait for all batches in the group to complete
      const groupResults = await Promise.all(groupPromises);
      
      // Flatten results and update state once per group
      const allResults = groupResults.flat();
      setEntries([...workingEntries]);
      
      // Update progress based on completed entries
      const completedInGroup = allResults.filter(r => r && r.success).length;
      const totalCompleted = Math.min(
        (groupStart + CONCURRENT_BATCHES) * BATCH_SIZE, 
        untranslatedEntries.length
      );
      
      setTranslationProgress({
        total: untranslatedEntries.length,
        completed: totalCompleted,
        current: `Selesai grup batch ${Math.ceil((groupStart + 1) / CONCURRENT_BATCHES)}`
      });
      
      // Update estimated tokens after group
      const updatedTokens = estimateTokens(workingEntries);
      setEstimatedTokens(updatedTokens);
      
      // No delay between batch groups for maximum speed
      if (groupStart + CONCURRENT_BATCHES < allBatches.length && DELAY_BETWEEN_BATCH_GROUPS > 0) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCH_GROUPS));
      }
    }

      if (cancelTranslationRef.current) {
        setTranslationProgress(prev => ({
          ...prev,
          current: 'Terjemahan dibatalkan!'
        }));
        setStatusMessage('Terjemahan dibatalkan oleh pengguna');
      } else {
        setTranslationProgress(prev => ({
          ...prev,
          current: 'Terjemahan selesai!'
        }));
      }

    } catch (error) {
      console.error('Translation process failed:', error);
      alert('Terjadi kesalahan saat menerjemahkan. Silakan coba lagi.');
    } finally {
      setIsTranslating(false);
      setIsCancelling(false);
      setTimeout(() => {
        setTranslationProgress({ total: 0, completed: 0, current: '' });
        setStatusMessage('');
      }, 1000); // Reduced from 3000ms to 1000ms
    }
  };

  const translateCurrentPage = async () => {
    if (isTranslating) return;
    
    const currentEntries = getCurrentPageEntries();
    const untranslatedEntries = currentEntries
      .map((entry, pageIndex) => ({ 
        ...entry, 
        originalIndex: (currentPage - 1) * itemsPerPage + pageIndex 
      }))
      .filter(entry => entry.english && !entry.indonesian.trim());

    if (untranslatedEntries.length === 0) {
      alert('Semua teks di halaman ini sudah diterjemahkan!');
      return;
    }

    setIsTranslating(true);
    setIsCancelling(false);
    cancelTranslationRef.current = false;
    // Set translation start time for speed calculation
    (window as any).translationStartTime = Date.now() / 1000;
    setTranslationProgress({
      total: untranslatedEntries.length,
      completed: 0,
      current: ''
    });

    const BATCH_SIZE = 40; // Increased from 25 to 40 for maximum throughput
    const CONCURRENT_BATCHES = 6; // Increased from 4 to 6 batches simultaneously for current page
    const DELAY_BETWEEN_BATCH_GROUPS = 0; // Removed delay for maximum speed

    try {
      // Create a working copy of entries to avoid race conditions
      let workingEntries = [...entries];
      
      // Create all batches first
      const allBatches = [];
      for (let i = 0; i < untranslatedEntries.length; i += BATCH_SIZE) {
        allBatches.push(untranslatedEntries.slice(i, i + BATCH_SIZE));
      }

      // Process batches in concurrent groups
      for (let groupStart = 0; groupStart < allBatches.length; groupStart += CONCURRENT_BATCHES) {
        // Check if translation was cancelled
        if (cancelTranslationRef.current) {
          break;
        }
        
        const batchGroup = allBatches.slice(groupStart, groupStart + CONCURRENT_BATCHES);
        
        // Process multiple batches concurrently
        const groupPromises = batchGroup.map(async (batch) => {
        
        const batchPromises = batch.map(async (entry) => {
          // Check if translation was cancelled before processing each entry
          if (cancelTranslationRef.current) {
            return;
          }
          
          const { originalIndex } = entry;
          
          setTranslationProgress(prev => ({
            ...prev,
            current: `Menerjemahkan: ${entry.key}`
          }));

          try {
            const { cleanText, placeholders } = cleanTextForTranslation(entry.english);
            
            // Skip translation if text is empty after cleaning
            if (!cleanText.trim()) {
              return { success: true, index: originalIndex, skipped: true };
            }

            // Use translateWithRetry for better handling of AI rejections
            const translatedText = await translateWithRetry(cleanText);
            
            // Restore placeholders in translated text
            const finalTranslation = restorePlaceholders(translatedText, placeholders);
            
            console.log('Page Translation result:', {
              originalText: entry.english,
              cleanText,
              translatedText: translatedText,
              finalTranslation,
              originalIndex
            });

            return { 
              success: true, 
              index: originalIndex, 
              translation: finalTranslation,
              key: entry.key
            };
          } catch (error) {
            console.error(`Translation failed for ${entry.key}:`, error);
            return { success: false, index: originalIndex, error };
          }
        });

        // Wait for all promises in the batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Update working entries with successful translations
        batchResults.forEach(result => {
          if (result && result.success && result.translation) {
            workingEntries[result.index] = {
              ...workingEntries[result.index],
              indonesian: result.translation
            };
          }
        });
        
        return batchResults;
      });

      // Wait for all batches in the group to complete
      const groupResults = await Promise.all(groupPromises);
      
      // Flatten results and update state once per group
      const allResults = groupResults.flat();
      setEntries([...workingEntries]);
      
      // Update progress based on completed entries
      const completedInGroup = allResults.filter(r => r && r.success).length;
      const totalCompleted = Math.min(
        (groupStart + CONCURRENT_BATCHES) * BATCH_SIZE, 
        untranslatedEntries.length
      );
      
      setTranslationProgress({
        total: untranslatedEntries.length,
        completed: totalCompleted,
        current: `Selesai grup batch ${Math.ceil((groupStart + 1) / CONCURRENT_BATCHES)} (halaman ini)`
      });
      
      // Update estimated tokens after group
      const updatedTokens = estimateTokens(workingEntries);
      setEstimatedTokens(updatedTokens);
      
      // No delay between batch groups for maximum speed
      if (groupStart + CONCURRENT_BATCHES < allBatches.length && DELAY_BETWEEN_BATCH_GROUPS > 0) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCH_GROUPS));
      }
    }

      if (cancelTranslationRef.current) {
        setTranslationProgress(prev => ({
          ...prev,
          current: 'Terjemahan halaman dibatalkan!'
        }));
        setStatusMessage('Terjemahan halaman dibatalkan oleh pengguna');
      } else {
        setTranslationProgress(prev => ({
          ...prev,
          current: 'Terjemahan halaman selesai!'
        }));
      }

    } catch (error) {
      console.error('Page translation process failed:', error);
      alert('Terjadi kesalahan saat menerjemahkan halaman. Silakan coba lagi.');
    } finally {
      setIsTranslating(false);
      setIsCancelling(false);
      setTimeout(() => {
        setTranslationProgress({ total: 0, completed: 0, current: '' });
        setStatusMessage('');
      }, 1000); // Reduced from 3000ms to 1000ms
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
            FM Translator (.ltf)
          </h1>

          <div className="mb-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".ltf"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="hidden"
                disabled={isUploading}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {isUploading ? 'Memproses...' : 'Upload .ltf File'}
              </button>
              {fileName && (
                <p className="mt-2 text-gray-600">File: {fileName}</p>
              )}
              
              {isUploading && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="mt-2 text-sm text-blue-600">{uploadProgress}%</p>
                </div>
              )}
            </div>
          </div>

          {statusMessage && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 text-center font-medium">{statusMessage}</p>
            </div>
          )}

          {entries.length > 0 && (
            <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl shadow-sm">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Statistik Terjemahan
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Total Entries Card */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Entries</p>
                      <p className="text-2xl font-bold text-gray-900">{entries.length.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Translated Card */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Diterjemahkan</p>
                      <p className="text-2xl font-bold text-green-600">
                        {entries.filter(entry => entry.indonesian.trim()).length.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {entries.length > 0 ? Math.round((entries.filter(entry => entry.indonesian.trim()).length / entries.length) * 100) : 0}% selesai
                      </p>
                    </div>
                    <div className="p-3 bg-green-100 rounded-full">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Remaining Card */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Tersisa</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {untranslatedCount.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-orange-100 rounded-full">
                      <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Estimated Tokens Card */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Est. Tokens</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {estimatedTokens.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-3 bg-purple-100 rounded-full">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Estimated Cost Card */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Est. Biaya</p>
                      <div className="text-lg font-bold text-red-600">
                        {estimatedTokens > 0 ? (
                          <>
                            <div>${estimateCost(estimatedTokens).usd.toFixed(3)}</div>
                            <div className="text-sm font-normal text-gray-500">
                              Rp {Math.round(estimateCost(estimatedTokens).idr).toLocaleString()}
                            </div>
                          </>
                        ) : (
                          <div>$0</div>
                        )}
                      </div>
                    </div>
                    <div className="p-3 bg-red-100 rounded-full">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Estimated Time Card */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Est. Waktu</p>
                      <p className="text-2xl font-bold text-indigo-600">
                        {estimateTime(untranslatedCount)}
                      </p>
                    </div>
                    <div className="p-3 bg-indigo-100 rounded-full">
                      <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Progress Bar */}
              {entries.length > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Progress Terjemahan</span>
                    <span>{Math.round((entries.filter(entry => entry.indonesian.trim()).length / entries.length) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${(entries.filter(entry => entry.indonesian.trim()).length / entries.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              <div className="mt-4 text-xs text-gray-500 text-center">
                *Estimasi untuk menerjemahkan semua teks yang belum diterjemahkan (1 USD = 15.000 IDR)
              </div>
            </div>
          )}

          {isTranslating && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-yellow-800 font-medium">Progress Terjemahan</span>
                <span className="text-yellow-600">
                  {translationProgress.total > 0 
                    ? `${translationProgress.completed}/${translationProgress.total} (${Math.round((translationProgress.completed / translationProgress.total) * 100)}%)`
                    : '0%'
                  }
                </span>
              </div>
              
              {/* Enhanced Progress Bar with ETA */}
              <div className="w-full bg-yellow-200 rounded-full h-4 mb-3 relative overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-yellow-500 to-yellow-600 h-4 rounded-full transition-all duration-500 relative"
                  style={{ 
                    width: translationProgress.total > 0 
                      ? `${(translationProgress.completed / translationProgress.total) * 100}%` 
                      : '0%' 
                  }}
                >
                  {/* Animated shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                </div>
              </div>
              
              {/* Detailed Progress Information */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-yellow-700">
                  <div className="font-medium">Status:</div>
                  <div className="truncate">{translationProgress.current || 'Memulai...'}</div>
                </div>
                <div className="text-yellow-700">
                  <div className="font-medium">Estimasi Sisa Waktu:</div>
                  <div>
                    {translationProgress.total > 0 && translationProgress.completed > 0
                      ? estimateTime(translationProgress.total - translationProgress.completed)
                      : 'Menghitung...'
                    }
                  </div>
                </div>
              </div>
              
              {/* Speed indicator */}
              {translationProgress.completed > 0 && (
                <div className="mt-2 text-xs text-yellow-600">
                  Kecepatan: ~{(translationProgress.completed / Math.max(1, Date.now() / 1000 - (window as any).translationStartTime || 1) * 60).toFixed(1)} entri/menit
                </div>
              )}
              
              {/* Cancel Button */}
              <div className="mt-4 flex justify-center">
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
            </div>
          )}

          {entries.length > 0 && (
            <div className="mb-6 bg-white p-6 rounded-lg border-2 border-gray-300 shadow-lg">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                {/* Pagination Info - Always show when there are entries */}
                <div className="text-base text-gray-800 font-medium">
                  Menampilkan <span className="font-bold text-blue-600">{Math.min((currentPage - 1) * itemsPerPage + 1, entries.length)}</span> - <span className="font-bold text-blue-600">{Math.min(currentPage * itemsPerPage, entries.length)}</span> dari <span className="font-bold text-blue-600">{entries.length.toLocaleString()}</span> entri
                </div>
                
                {/* Pagination Controls - Only show if more than 1 page */}
                {Math.ceil(entries.length / itemsPerPage) > 1 && (
                  <div className="flex items-center gap-2">
                  {/* First Page Button */}
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-gray-700 hover:text-gray-900"
                    title="Halaman Pertama"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  {/* Previous Page Button */}
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-gray-700 hover:text-gray-900"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  {/* Page Numbers */}
                  <div className="flex gap-1">
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
                      
                      // Show first page if not in range
                      if (startPage > 1) {
                        pages.push(
                          <button
                            key={1}
                            onClick={() => setCurrentPage(1)}
                            className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700 hover:text-gray-900"
                          >
                            1
                          </button>
                        );
                        if (startPage > 2) {
                          pages.push(
                            <span key="ellipsis1" className="w-10 h-10 flex items-center justify-center text-gray-500">
                              ...
                            </span>
                          );
                        }
                      }
                      
                      // Show page numbers in range
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
                      
                      // Show last page if not in range
                      if (endPage < totalPages) {
                        if (endPage < totalPages - 1) {
                          pages.push(
                            <span key="ellipsis2" className="w-10 h-10 flex items-center justify-center text-gray-500">
                              ...
                            </span>
                          );
                        }
                        pages.push(
                          <button
                            key={totalPages}
                            onClick={() => setCurrentPage(totalPages)}
                            className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700 hover:text-gray-900"
                          >
                            {totalPages}
                          </button>
                        );
                      }
                      
                      return pages;
                    })()}
                  </div>
                  
                  {/* Next Page Button */}
                  <button
                    onClick={() => setCurrentPage(Math.min(Math.ceil(entries.length / itemsPerPage), currentPage + 1))}
                    disabled={currentPage === Math.ceil(entries.length / itemsPerPage)}
                    className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-gray-700 hover:text-gray-900"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  
                  {/* Last Page Button */}
                  <button
                    onClick={() => setCurrentPage(Math.ceil(entries.length / itemsPerPage))}
                    disabled={currentPage === Math.ceil(entries.length / itemsPerPage)}
                    className="w-10 h-10 flex items-center justify-center border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors text-gray-700 hover:text-gray-900"
                    title="Halaman Terakhir"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                )}
              </div>
              
              {/* Quick Jump - Only show if more than 1 page */}
              {Math.ceil(entries.length / itemsPerPage) > 1 && (
                <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                 <div className="flex flex-col sm:flex-row items-center gap-4">
                   <div className="flex items-center gap-2 text-sm">
                     <label htmlFor="jumpToPage" className="text-gray-700 font-medium">Lompat ke halaman:</label>
                     <input
                       id="jumpToPage"
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
                       className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     />
                     <span className="text-gray-600">dari {Math.ceil(entries.length / itemsPerPage)}</span>
                   </div>
                   
                   <div className="flex items-center gap-2 text-sm">
                     <label htmlFor="itemsPerPage" className="text-gray-700 font-medium">Tampilkan:</label>
                     <select
                       id="itemsPerPage"
                       value={itemsPerPage}
                       onChange={(e) => {
                         const newItemsPerPage = parseInt(e.target.value);
                         setItemsPerPage(newItemsPerPage);
                         // Reset to page 1 when changing items per page
                         setCurrentPage(1);
                       }}
                       className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                     >
                       <option value={25}>25</option>
                       <option value={50}>50</option>
                       <option value={100}>100</option>
                       <option value={200}>200</option>
                       <option value={500}>500</option>
                     </select>
                     <span className="text-gray-600">entri per halaman</span>
                   </div>
                 </div>
                 
                 <div className="text-base text-gray-800 font-medium">
                   <span className="font-bold text-blue-600">Halaman {currentPage}</span> dari <span className="font-bold text-blue-600">{Math.ceil(entries.length / itemsPerPage)}</span>
                 </div>
               </div>
               )}
            </div>
          )}

          {entries.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-4 justify-center">
              <button
                onClick={translateAll}
                disabled={isTranslating}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  isTranslating
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
                disabled={entries.length === 0}
                className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                  entries.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                Export LTF
              </button>
            </div>
          )}

          {entries.length > 0 && (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left font-medium text-gray-800">
                        KEY
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-medium text-gray-800">
                        English
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-medium text-gray-800">
                        Indonesian
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-medium text-gray-800">
                        Action
                      </th>
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
                            <td className="border border-gray-300 px-4 py-2 font-mono text-sm relative text-gray-800">
                              {entry.key}
                              {currentTranslatingIndex === actualIndex && (
                                <div className="absolute right-2 top-2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                                </div>
                              )}
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-gray-800">
                              {entry.english}
                            </td>
                            <td className="border border-gray-300 px-4 py-2">
                              <textarea
                                value={entry.indonesian}
                                onChange={(e) => handleIndonesianChange(actualIndex, e.target.value)}
                                className="w-full min-h-[60px] p-2 border border-gray-200 rounded resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                                placeholder="Indonesian translation..."
                                disabled={currentTranslatingIndex === actualIndex}
                              />
                            </td>
                            <td className="border border-gray-300 px-4 py-2 text-center">
                              <button
                                onClick={() => translateSingle(actualIndex)}
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
    </div>
  );
}
