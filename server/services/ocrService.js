// Advanced OCR Service - Optimized for Indian Receipts
// Deep research implementation with multiple OCR engines and smart parsing

const axios = require('axios');
const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const FormData = require('form-data');

class AdvancedOCRService {
    constructor() {
        this.ocrSpaceApiKey = process.env.OCR_SPACE_API_KEY;
        this.ocrSpaceUrl = 'https://api.ocr.space/parse/image';

        // Indian receipt patterns and keywords
        this.indianPatterns = {
            currency: /₹|rs\.?|inr|rupees?/gi,
            gst: /gst|vat|tax|cgst|sgst|igst/gi,
            serviceCharge: /service\s*charge|s\.?c\.?|tip/gi,
            total: /total|grand\s*total|net\s*total|amount\s*payable|final\s*amount|fare|price/gi,
            subtotal: /sub\s*total|subtotal|net\s*amount|basic\s*amount|base\s*fare/gi,
            phone: /(\+91[\s-]?)?[6-9]\d{9}|\d{2,4}[-\s]?\d{6,8}/g,
            email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            indianCities: /delhi|mumbai|bangalore|chennai|hyderabad|pune|kolkata|ahmedabad|jaipur|lucknow|kanpur|nagpur|indore|thane|bhopal|visakhapatnam|pimpri|patna|vadodara|ghaziabad|ludhiana|agra|nashik|faridabad|meerut|rajkot|kalyan|vasai|varanasi|srinagar|aurangabad|dhanbad|amritsar|navi\s*mumbai|allahabad|ranchi|howrah|coimbatore|jabalpur|gwalior|vijayawada|jodhpur|madurai|raipur|kota|guwahati|chandigarh|solapur|hubli|tiruchirappalli|bareilly|mysore|tiruppur|gurgaon|aligarh|jalandhar|bhubaneswar|salem|warangal|guntur|bhiwandi|saharanpur|gorakhpur|bikaner|amravati|noida|jamshedpur|bhilai|cuttack|firozabad|kochi|nellore|bhavnagar|dehradun|durgapur|asansol|rourkela|nanded|kolhapur|ajmer|akola|gulbarga|jamnagar|ujjain|loni|siliguri|jhansi|ulhasnagar|jammu|sangli|mangalore|erode|belgaum|ambattur|tirunelveli|malegaon|gaya|jalgaon|udaipur|maheshtala|karjan|koda|maka/gi,
            transportation: /bus|train|ticket|passenger|journey|depot|station|platform|seat|berth|coach|fare|distance|km|gsrtc|ksrtc|msrtc|apsrtc|tsrtc|upsrtc|rsrtc|hrtc|himachal|roadways|transport|corporation/gi
        };

        // Transportation-specific patterns
        this.transportPatterns = {
            busTicket: /gsrtc|ksrtc|msrtc|apsrtc|tsrtc|upsrtc|rsrtc|hrtc|bus|depot|passenger\s*ticket/gi,
            trainTicket: /irctc|indian\s*railway|train|platform|coach|berth|pnr/gi,
            route: /from|to|via|route|destination/gi,
            distance: /(\d+)\s*km|distance\s*(\d+)/gi,
            seatNumber: /seat\s*no|seat\s*number|berth\s*no/gi
        };

        // Common Indian food items and restaurant terms
        this.indianFoodTerms = [
            'biryani', 'curry', 'dal', 'rice', 'roti', 'naan', 'chapati', 'dosa', 'idli', 'sambar',
            'rasam', 'paneer', 'chicken', 'mutton', 'fish', 'prawn', 'tandoor', 'masala', 'gravy',
            'fry', 'roast', 'kebab', 'tikka', 'korma', 'vindaloo', 'butter', 'palak', 'aloo', 'gobi',
            'bhindi', 'baingan', 'karela', 'lassi', 'chai', 'coffee', 'juice', 'water', 'soda',
            'coke', 'pepsi', 'sprite', 'limca', 'thums', 'maaza', 'frooti', 'slice'
        ];
    }

    async processImage(imageBuffer, metadata = {}) {
        try {
            console.log('🔍 Starting Advanced OCR processing...', {
                size: imageBuffer.length,
                filename: metadata.filename
            });

            // Multi-stage image preprocessing
            const processedImages = await this.advancedPreprocessing(imageBuffer);

            let bestResult = null;
            let bestConfidence = 0;
            let ocrMethod = 'none';

            // Try OCR.space API with multiple configurations
            if (this.ocrSpaceApiKey && this.ocrSpaceApiKey !== 'your_ocr_space_api_key_here') {
                for (const [configName, imageBuffer] of Object.entries(processedImages)) {
                    try {
                        console.log(`🌐 Attempting OCR.space API with ${configName}...`);
                        const result = await this.processWithOCRSpace(imageBuffer, configName);

                        if (result.confidence > bestConfidence) {
                            bestResult = result;
                            bestConfidence = result.confidence;
                            ocrMethod = `OCR.space API (${configName})`;
                        }
                    } catch (error) {
                        console.warn(`OCR.space ${configName} failed:`, error.message);
                    }
                }
            }

            // Fallback to Tesseract.js with multiple configurations
            if (!bestResult || bestConfidence < 0.7) {
                for (const [configName, imageBuffer] of Object.entries(processedImages)) {
                    try {
                        console.log(`🔧 Attempting Tesseract.js with ${configName}...`);
                        const result = await this.processWithTesseract(imageBuffer, configName);

                        if (result.confidence > bestConfidence) {
                            bestResult = result;
                            bestConfidence = result.confidence;
                            ocrMethod = `Tesseract.js (${configName})`;
                        }
                    } catch (error) {
                        console.warn(`Tesseract ${configName} failed:`, error.message);
                    }
                }
            }

            if (!bestResult) {
                throw new Error('All OCR methods failed');
            }

            console.log(`✅ Best OCR result: ${ocrMethod} (confidence: ${bestConfidence})`);

            // Advanced receipt data extraction
            const extractedData = await this.advancedReceiptExtraction(bestResult.text);
            extractedData.ocrMethod = ocrMethod;
            extractedData.rawText = bestResult.text;
            extractedData.confidence = bestConfidence;

            return {
                success: true,
                data: extractedData
            };

        } catch (error) {
            console.error('❌ OCR processing failed:', error);
            return {
                success: false,
                error: error.message || 'OCR processing failed'
            };
        }
    }

    async advancedPreprocessing(imageBuffer) {
        try {
            const results = {};

            // Get image metadata
            const metadata = await sharp(imageBuffer).metadata();
            console.log('📊 Image metadata:', { width: metadata.width, height: metadata.height, format: metadata.format });

            // Configuration 1: High contrast for clear text (fixed gamma issue)
            results.highContrast = await sharp(imageBuffer)
                .resize(2000, null, {
                    fit: 'inside',
                    withoutEnlargement: false,
                    kernel: sharp.kernel.lanczos3
                })
                .grayscale()
                .normalize()
                .linear(1.5, -(128 * 1.5) + 128) // Increase contrast
                .sharpen({ sigma: 1, flat: 1, jagged: 2 })
                .threshold(128) // Binary threshold
                .jpeg({ quality: 95 })
                .toBuffer();

            // Configuration 2: Enhanced for receipts (fixed gamma)
            results.receiptOptimized = await sharp(imageBuffer)
                .resize(1800, null, {
                    fit: 'inside',
                    withoutEnlargement: false
                })
                .grayscale()
                .gamma(1.2) // Fixed gamma value (must be > 1.0)
                .normalize()
                .sharpen({ sigma: 1.5 })
                .modulate({ brightness: 1.1, saturation: 0 })
                .jpeg({ quality: 90 })
                .toBuffer();

            // Configuration 3: Noise reduction
            results.denoised = await sharp(imageBuffer)
                .resize(1600, null, { fit: 'inside' })
                .grayscale()
                .blur(0.3) // Slight blur to reduce noise
                .normalize()
                .linear(1.2, -20) // Adjust brightness and contrast
                .sharpen({ sigma: 0.5, flat: 1, jagged: 1 })
                .jpeg({ quality: 85 })
                .toBuffer();

            // Configuration 4: Transportation optimized (new)
            results.transportOptimized = await sharp(imageBuffer)
                .resize(2200, null, {
                    fit: 'inside',
                    withoutEnlargement: false
                })
                .grayscale()
                .normalize()
                .sharpen({ sigma: 2, flat: 1, jagged: 3 }) // Aggressive sharpening for small text
                .linear(1.8, -50) // High contrast for thermal prints
                .jpeg({ quality: 98 })
                .toBuffer();

            // Configuration 5: Original with minimal processing
            results.minimal = await sharp(imageBuffer)
                .resize(1920, 1080, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: 92 })
                .toBuffer();

            console.log('🖼️ Generated', Object.keys(results).length, 'preprocessed versions');
            return results;

        } catch (error) {
            console.warn('⚠️ Advanced preprocessing failed, using basic:', error.message);

            // Fallback to basic preprocessing
            const basic = await sharp(imageBuffer)
                .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 90 })
                .toBuffer();

            return { basic };
        }
    }

    async processWithOCRSpace(imageBuffer, configName = 'default') {
        try {
            const formData = new FormData();
            formData.append('file', imageBuffer, { filename: 'receipt.jpg' });
            formData.append('apikey', this.ocrSpaceApiKey);
            formData.append('language', 'eng');
            formData.append('isOverlayRequired', 'false');
            formData.append('detectOrientation', 'true');
            formData.append('isTable', 'true');
            formData.append('scale', 'true');
            formData.append('OCREngine', '2'); // Engine 2 is better for receipts
            formData.append('isSearchablePdfHideTextLayer', 'false');

            const response = await axios.post(this.ocrSpaceUrl, formData, {
                headers: {
                    ...formData.getHeaders(),
                },
                timeout: 45000, // 45 second timeout
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            if (response.data.IsErroredOnProcessing) {
                throw new Error(response.data.ErrorMessage || 'OCR.space processing error');
            }

            const parsedResults = response.data.ParsedResults;
            if (!parsedResults || parsedResults.length === 0) {
                throw new Error('No text found in image');
            }

            const text = parsedResults[0].ParsedText || '';
            const confidence = this.calculateConfidence(text, 'ocrspace');

            return {
                text: text,
                confidence: confidence
            };

        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                throw new Error('OCR.space API timeout');
            }
            throw new Error(`OCR.space API error: ${error.message}`);
        }
    }

    async processWithTesseract(imageBuffer, configName = 'default') {
        try {
            // Advanced Tesseract configuration for receipts
            const tesseractConfig = {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`📝 Tesseract ${configName}: ${Math.round(m.progress * 100)}%`);
                    }
                },
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
                tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
                preserve_interword_spaces: '1',
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz₹.,()-+/:@# ',
            };

            const { data } = await Tesseract.recognize(imageBuffer, 'eng', tesseractConfig);

            const confidence = this.calculateConfidence(data.text, 'tesseract', data.confidence);

            return {
                text: data.text || '',
                confidence: confidence / 100
            };

        } catch (error) {
            throw new Error(`Tesseract error: ${error.message}`);
        }
    }

    calculateConfidence(text, method, baseConfidence = 0.7) {
        if (!text || text.trim().length === 0) return 0;

        let confidence = baseConfidence;

        // Boost confidence for Indian receipt indicators
        if (this.indianPatterns.currency.test(text)) confidence += 0.1;
        if (this.indianPatterns.gst.test(text)) confidence += 0.1;
        if (this.indianPatterns.phone.test(text)) confidence += 0.05;
        if (this.indianPatterns.total.test(text)) confidence += 0.1;

        // Boost confidence for transportation indicators
        if (this.indianPatterns.transportation.test(text)) confidence += 0.15;
        if (this.transportPatterns.busTicket.test(text)) confidence += 0.1;
        if (this.transportPatterns.trainTicket.test(text)) confidence += 0.1;

        // Check for food terms
        const foodTermsFound = this.indianFoodTerms.filter(term =>
            text.toLowerCase().includes(term)
        ).length;
        confidence += Math.min(foodTermsFound * 0.02, 0.1);

        // Check for price patterns
        const priceMatches = text.match(/₹\s*\d+(?:\.\d{2})?|\d+\.\d{2}|\d{2,3},\d{2}/g);
        if (priceMatches && priceMatches.length > 0) {
            confidence += Math.min(priceMatches.length * 0.03, 0.15);
        }

        // Check for Indian cities
        if (this.indianPatterns.indianCities.test(text)) confidence += 0.05;

        // Penalize very short text
        if (text.length < 50) confidence -= 0.2;

        return Math.min(Math.max(confidence, 0), 1);
    }

    async advancedReceiptExtraction(text) {
        if (!text || text.trim().length === 0) {
            return this.getEmptyReceiptData();
        }

        console.log('🔍 Starting advanced receipt extraction...');

        // Clean and normalize text
        const cleanedText = this.cleanText(text);
        const lines = cleanedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        // Detect receipt type
        const receiptType = this.detectReceiptType(text);
        console.log('📋 Detected receipt type:', receiptType);

        const extractedData = {
            items: [],
            subtotal: 0,
            tax: 0,
            serviceCharge: 0,
            total: 0,
            merchantInfo: {
                name: null,
                address: null,
                phone: null,
                email: null
            },
            receiptType: receiptType
        };

        // Use specialized extraction based on receipt type
        if (receiptType === 'transportation') {
            await this.extractTransportationData(lines, extractedData);
        } else {
            // Default restaurant/retail extraction
            await this.extractMerchantInfo(lines, extractedData);
            await this.extractItemsAndPrices(lines, extractedData);
            await this.extractTotalsAndCharges(lines, extractedData);
        }

        // Validate and fix data
        this.validateAndFixData(extractedData);

        console.log('✅ Advanced extraction complete:', {
            type: receiptType,
            items: extractedData.items.length,
            total: extractedData.total,
            merchant: extractedData.merchantInfo.name
        });

        return extractedData;
    }

    detectReceiptType(text) {
        const lowerText = text.toLowerCase();

        // Check for transportation indicators
        if (this.transportPatterns.busTicket.test(text) ||
            lowerText.includes('passenger ticket') ||
            lowerText.includes('depot') ||
            lowerText.includes('journey')) {
            return 'transportation';
        }

        if (this.transportPatterns.trainTicket.test(text)) {
            return 'train';
        }

        // Check for restaurant indicators
        if (this.indianFoodTerms.some(term => lowerText.includes(term)) ||
            lowerText.includes('restaurant') ||
            lowerText.includes('hotel') ||
            lowerText.includes('cafe')) {
            return 'restaurant';
        }

        // Check for retail indicators
        if (lowerText.includes('invoice') ||
            lowerText.includes('bill') ||
            lowerText.includes('purchase')) {
            return 'retail';
        }

        return 'general';
    }

    async extractTransportationData(lines, extractedData) {
        console.log('🚌 Extracting transportation ticket data...');

        let route = { from: null, to: null };
        let distance = null;
        let fare = null;
        let possibleFares = [];

        for (const line of lines) {
            const lowerLine = line.toLowerCase();

            // Extract organization name (GSRTC, KSRTC, etc.)
            if (!extractedData.merchantInfo.name) {
                if (lowerLine.includes('depot')) {
                    // Extract depot name
                    const depotMatch = line.match(/([A-Z\s]+)\s*DEPOT/i);
                    if (depotMatch) {
                        extractedData.merchantInfo.name = `${depotMatch[1].trim()} DEPOT`;
                    }
                } else if (this.transportPatterns.busTicket.test(line)) {
                    extractedData.merchantInfo.name = this.extractTransportOrgName(line);
                }
            }

            // Extract route information dynamically
            const routeInfo = this.extractRouteInformation(line);
            if (routeInfo.from && !route.from) {
                route.from = routeInfo.from;
            }
            if (routeInfo.to && !route.to) {
                route.to = routeInfo.to;
            }

            // Extract distance
            const distanceMatch = line.match(/(\d+)\s*km/i);
            if (distanceMatch) {
                distance = parseInt(distanceMatch[1]);
            }

            // Extract fare/price - be more selective for transportation
            const priceMatches = this.extractPricesFromLine(line);
            if (priceMatches.length > 0) {
                // For transportation, look for reasonable fare amounts (₹10 - ₹2000)
                const reasonableFares = priceMatches.filter(price => price >= 10 && price <= 2000);
                if (reasonableFares.length > 0) {
                    possibleFares.push(...reasonableFares);
                }
            }

            // Extract phone number
            const phoneMatch = line.match(this.indianPatterns.phone);
            if (phoneMatch && !extractedData.merchantInfo.phone) {
                extractedData.merchantInfo.phone = phoneMatch[0];
            }
        }

        // Advanced fare selection with context analysis
        if (possibleFares.length > 0) {
            possibleFares.sort((a, b) => b - a); // Sort descending

            console.log('💰 Analyzing possible fares:', possibleFares);

            // Look for explicit fare indicators in the text
            fare = this.findExplicitFare(lines, possibleFares);

            if (!fare) {
                // Enhanced smart fare selection logic
                console.log('🤔 No explicit fare found, using smart selection from:', possibleFares);

                if (possibleFares.length === 1) {
                    fare = possibleFares[0];
                    console.log('✅ Only one fare available:', fare);
                } else if (possibleFares.length === 2) {
                    // Common case: two prices, usually the higher one is the actual fare
                    // The lower might be a reference number, distance, or partial amount
                    fare = Math.max(...possibleFares);
                    console.log('✅ Two fares found, selecting higher:', fare, 'vs', Math.min(...possibleFares));
                } else {
                    // Multiple fares: use advanced scoring
                    const scoredFares = this.scoreFaresByContext(possibleFares, lines);
                    fare = scoredFares[0].fare;
                    console.log('✅ Multiple fares, selected by scoring:', fare);
                }
            }

            extractedData.total = fare;
            console.log('🎯 Selected fare:', fare);
        }

        // Create transportation item
        if (route.from && route.to) {
            const itemName = `${route.from} to ${route.to}${distance ? ` (${distance} km)` : ''}`;
            extractedData.items.push({
                name: itemName,
                price: fare || 0,
                quantity: 1,
                type: 'transportation'
            });
        } else if (fare) {
            // Generic transportation item
            extractedData.items.push({
                name: 'Bus Ticket',
                price: fare,
                quantity: 1,
                type: 'transportation'
            });
        }

        // Set subtotal same as total for transportation
        extractedData.subtotal = extractedData.total;

        console.log('🎯 Transportation extraction results:', {
            merchant: extractedData.merchantInfo.name,
            route: `${route.from} to ${route.to}`,
            distance: distance,
            possibleFares: possibleFares,
            selectedFare: fare
        });
    }

    findExplicitFare(lines, possibleFares) {
        console.log('🔍 Analyzing lines for explicit fare:', possibleFares);

        // Score each fare based on context
        const fareScores = possibleFares.map(fare => ({ fare, score: 0 }));

        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            const pricesInLine = this.extractPricesFromLine(line);

            console.log(`📝 Line: "${line}" | Prices found: [${pricesInLine.join(', ')}]`);

            // Score fares based on context keywords
            pricesInLine.forEach(price => {
                const fareIndex = fareScores.findIndex(f => Math.abs(f.fare - price) < 0.01);
                if (fareIndex !== -1) {
                    let lineScore = 0;

                    // High priority keywords for actual fare
                    if (lowerLine.includes('fare') || lowerLine.includes('amount')) lineScore += 20;
                    if (lowerLine.includes('total') || lowerLine.includes('net')) lineScore += 15;
                    if (lowerLine.includes('price') || lowerLine.includes('cost')) lineScore += 12;

                    // Transportation specific keywords
                    if (lowerLine.includes('passenger') || lowerLine.includes('ticket')) lineScore += 10;
                    if (lowerLine.includes('journey') || lowerLine.includes('travel')) lineScore += 8;

                    // Bonus for decimal format (more likely to be actual fare)
                    if (price % 1 !== 0) lineScore += 5;

                    // Bonus for being the last/prominent price on a line
                    const lastPrice = pricesInLine[pricesInLine.length - 1];
                    if (Math.abs(price - lastPrice) < 0.01) lineScore += 3;

                    // Penalty for being in lines with non-fare keywords
                    if (lowerLine.includes('distance') || lowerLine.includes('km')) lineScore -= 5;
                    if (lowerLine.includes('time') || lowerLine.includes('date')) lineScore -= 8;
                    if (lowerLine.includes('seat') || lowerLine.includes('berth')) lineScore -= 3;

                    fareScores[fareIndex].score += lineScore;
                    console.log(`💰 Fare ${price} scored ${lineScore} points from line: "${line}"`);
                }
            });
        }

        // Sort by score and return the highest scoring fare
        fareScores.sort((a, b) => b.score - a.score);
        console.log('🏆 Fare scores:', fareScores);

        if (fareScores.length > 0 && fareScores[0].score > 0) {
            console.log(`✅ Selected fare based on context: ${fareScores[0].fare} (score: ${fareScores[0].score})`);
            return fareScores[0].fare;
        }

        return null;
    }

    scoreFaresByContext(possibleFares, lines) {
        const fareScores = possibleFares.map(fare => ({
            fare,
            score: 0,
            reasons: []
        }));

        fareScores.forEach(fareObj => {
            const fare = fareObj.fare;

            // Base scoring by fare amount patterns
            if (fare >= 100 && fare <= 300) {
                fareObj.score += 10;
                fareObj.reasons.push('typical bus fare range');
            }

            if (fare >= 50 && fare <= 500) {
                fareObj.score += 5;
                fareObj.reasons.push('reasonable intercity fare');
            }

            // Decimal format bonus (actual fares often have decimals)
            if (fare % 1 !== 0) {
                fareObj.score += 8;
                fareObj.reasons.push('decimal format');
            }

            // Penalize very round numbers (might be distances, seat numbers, etc.)
            if (fare % 100 === 0 && fare > 100) {
                fareObj.score -= 3;
                fareObj.reasons.push('very round number penalty');
            }

            // Penalize numbers that look like distances or other data
            if (fare >= 100 && fare <= 150 && fare % 1 === 0) {
                // Could be distance in km
                fareObj.score -= 2;
                fareObj.reasons.push('possible distance number');
            }

            // Bonus for being the highest fare (actual fare usually highest)
            if (fare === Math.max(...possibleFares)) {
                fareObj.score += 7;
                fareObj.reasons.push('highest amount');
            }

            // Penalty for being suspiciously low
            if (fare < 50) {
                fareObj.score -= 10;
                fareObj.reasons.push('too low for intercity fare');
            }

            // Penalty for being suspiciously high
            if (fare > 1000) {
                fareObj.score -= 15;
                fareObj.reasons.push('too high for bus fare');
            }
        });

        // Sort by score (highest first)
        fareScores.sort((a, b) => b.score - a.score);

        console.log('🎯 Fare scoring results:');
        fareScores.forEach(f => {
            console.log(`   ₹${f.fare}: ${f.score} points (${f.reasons.join(', ')})`);
        });

        return fareScores;
    }

    extractTransportOrgName(line) {
        // Extract organization name from transportation tickets
        if (/gsrtc/i.test(line)) return 'Gujarat State Road Transport Corporation (GSRTC)';
        if (/ksrtc/i.test(line)) return 'Karnataka State Road Transport Corporation (KSRTC)';
        if (/msrtc/i.test(line)) return 'Maharashtra State Road Transport Corporation (MSRTC)';
        if (/apsrtc/i.test(line)) return 'Andhra Pradesh State Road Transport Corporation (APSRTC)';
        if (/tsrtc/i.test(line)) return 'Telangana State Road Transport Corporation (TSRTC)';

        // Extract depot name
        const depotMatch = line.match(/([A-Z\s]+)\s+DEPOT/i);
        if (depotMatch) {
            return `${depotMatch[1].trim()} DEPOT`;
        }

        return line.trim();
    }

    extractRouteInformation(line) {
        const route = { from: null, to: null };
        const lowerLine = line.toLowerCase();

        // Pattern 1: "FROM X TO Y" or "X TO Y"
        const fromToPattern = /(?:from\s+)?([A-Z][A-Z\s]{2,20}?)\s+to\s+([A-Z][A-Z\s]{2,20}?)(?:\s|$)/i;
        const fromToMatch = line.match(fromToPattern);
        if (fromToMatch) {
            route.from = fromToMatch[1].trim().toUpperCase();
            route.to = fromToMatch[2].trim().toUpperCase();
            return route;
        }

        // Pattern 2: "X - Y" or "X-Y" (dash separated)
        const dashPattern = /([A-Z][A-Z\s]{2,15}?)\s*[-–—]\s*([A-Z][A-Z\s]{2,15}?)(?:\s|$)/i;
        const dashMatch = line.match(dashPattern);
        if (dashMatch) {
            route.from = dashMatch[1].trim().toUpperCase();
            route.to = dashMatch[2].trim().toUpperCase();
            return route;
        }

        // Pattern 3: Look for city names from our Indian cities pattern
        const cityMatches = line.match(this.indianPatterns.indianCities);
        if (cityMatches && cityMatches.length >= 2) {
            // Take first two unique cities found
            const uniqueCities = [...new Set(cityMatches.map(city => city.toUpperCase()))];
            if (uniqueCities.length >= 2) {
                route.from = uniqueCities[0];
                route.to = uniqueCities[1];
                return route;
            }
        }

        // Pattern 4: "ORIGIN" and "DESTINATION" keywords
        if (lowerLine.includes('origin') || lowerLine.includes('source')) {
            const originMatch = line.match(/(?:origin|source)[:\s]+([A-Z][A-Z\s]{2,20}?)(?:\s|$)/i);
            if (originMatch) {
                route.from = originMatch[1].trim().toUpperCase();
            }
        }

        if (lowerLine.includes('destination') || lowerLine.includes('dest')) {
            const destMatch = line.match(/(?:destination|dest)[:\s]+([A-Z][A-Z\s]{2,20}?)(?:\s|$)/i);
            if (destMatch) {
                route.to = destMatch[1].trim().toUpperCase();
            }
        }

        // Pattern 5: Route number patterns like "Route: X to Y"
        const routePattern = /route[:\s]+([A-Z][A-Z\s]{2,15}?)\s+(?:to|->)\s+([A-Z][A-Z\s]{2,15}?)(?:\s|$)/i;
        const routeMatch = line.match(routePattern);
        if (routeMatch) {
            route.from = routeMatch[1].trim().toUpperCase();
            route.to = routeMatch[2].trim().toUpperCase();
            return route;
        }

        // Pattern 6: Station/Stop patterns
        if (lowerLine.includes('boarding') || lowerLine.includes('pickup')) {
            const boardingMatch = line.match(/(?:boarding|pickup)[:\s]+([A-Z][A-Z\s]{2,20}?)(?:\s|$)/i);
            if (boardingMatch) {
                route.from = boardingMatch[1].trim().toUpperCase();
            }
        }

        if (lowerLine.includes('dropping') || lowerLine.includes('drop')) {
            const droppingMatch = line.match(/(?:dropping|drop)[:\s]+([A-Z][A-Z\s]{2,20}?)(?:\s|$)/i);
            if (droppingMatch) {
                route.to = droppingMatch[1].trim().toUpperCase();
            }
        }

        return route;
    }

    cleanText(text) {
        return text
            .replace(/[^\w\s₹.,()-+/:@#]/g, ' ') // Remove special characters except useful ones
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/₹\s+/g, '₹') // Fix currency spacing
            .trim();
    }

    async extractMerchantInfo(lines, extractedData) {
        const merchantCandidates = [];

        for (let i = 0; i < Math.min(10, lines.length); i++) {
            const line = lines[i];
            const lowerLine = line.toLowerCase();

            // Score potential merchant names
            if (!extractedData.merchantInfo.name && line.length > 3) {
                const merchantScore = this.scoreMerchantName(line, i);
                if (merchantScore > 0) {
                    merchantCandidates.push({
                        name: this.cleanMerchantName(line),
                        score: merchantScore,
                        line: i
                    });
                }
            }

            // Phone number - enhanced pattern matching
            const phoneMatch = line.match(this.indianPatterns.phone);
            if (phoneMatch && !extractedData.merchantInfo.phone) {
                extractedData.merchantInfo.phone = phoneMatch[0].replace(/\s+/g, '');
            }

            // Email - case insensitive
            const emailMatch = line.match(this.indianPatterns.email);
            if (emailMatch && !extractedData.merchantInfo.email) {
                extractedData.merchantInfo.email = emailMatch[0].toLowerCase();
            }

            // Address - dynamic detection
            if (!extractedData.merchantInfo.address && this.isAddressLine(line)) {
                extractedData.merchantInfo.address = line;
            }

            // Website/URL extraction
            const urlMatch = line.match(/(?:www\.|https?:\/\/)?[\w.-]+\.[a-z]{2,}/i);
            if (urlMatch && !extractedData.merchantInfo.website) {
                extractedData.merchantInfo.website = urlMatch[0];
            }

            // GST number extraction
            const gstMatch = line.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}\b/);
            if (gstMatch && !extractedData.merchantInfo.gstNumber) {
                extractedData.merchantInfo.gstNumber = gstMatch[0];
            }
        }

        // Select best merchant name candidate
        if (merchantCandidates.length > 0) {
            const bestCandidate = merchantCandidates.sort((a, b) => b.score - a.score)[0];
            extractedData.merchantInfo.name = bestCandidate.name;
        }
    }

    scoreMerchantName(line, lineIndex) {
        let score = 0;
        const lowerLine = line.toLowerCase();

        // Penalize if contains prices
        if (this.containsPrice(line)) score -= 20;

        // Penalize header-like lines
        if (this.isHeaderLine(line)) score -= 15;

        // Bonus for early lines (merchant name usually at top)
        if (lineIndex === 0) score += 15;
        else if (lineIndex <= 2) score += 10;
        else if (lineIndex <= 4) score += 5;

        // Bonus for business-like terms
        const businessTerms = [
            'restaurant', 'hotel', 'cafe', 'bar', 'dhaba', 'kitchen', 'foods', 'corner',
            'palace', 'garden', 'house', 'inn', 'store', 'shop', 'mart', 'center',
            'corporation', 'company', 'ltd', 'pvt', 'depot', 'transport', 'travels'
        ];

        businessTerms.forEach(term => {
            if (lowerLine.includes(term)) score += 8;
        });

        // Bonus for proper case (Title Case or UPPER CASE)
        if (line === line.toUpperCase() || this.isTitleCase(line)) score += 5;

        // Bonus for reasonable length
        if (line.length >= 5 && line.length <= 50) score += 5;

        // Penalize very short or very long lines
        if (line.length < 3) score -= 10;
        if (line.length > 80) score -= 5;

        // Penalize lines with too many numbers
        const numberCount = (line.match(/\d/g) || []).length;
        if (numberCount > line.length * 0.3) score -= 10;

        // Bonus for containing location names
        if (this.indianPatterns.indianCities.test(line)) score += 3;

        return score;
    }

    isTitleCase(str) {
        return str === str.replace(/\w\S*/g, (txt) =>
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }

    async extractItemsAndPrices(lines, extractedData) {
        const potentialItems = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lowerLine = line.toLowerCase();

            // Skip obvious non-item lines with enhanced detection
            if (this.shouldSkipLine(line, i, lines)) {
                continue;
            }

            // Look for lines with prices
            const priceMatches = this.extractPricesFromLine(line);
            if (priceMatches.length > 0) {
                const itemScore = this.scoreItemLine(line, i, lines);

                if (itemScore > 0) {
                    const itemName = this.extractItemName(line, priceMatches);
                    const price = this.selectBestPrice(priceMatches, line);
                    const quantity = this.extractQuantity(line);

                    if (itemName && itemName.length > 1 && price > 0) {
                        potentialItems.push({
                            name: itemName,
                            price: price,
                            quantity: quantity || 1,
                            score: itemScore,
                            lineIndex: i
                        });
                    }
                }
            }
        }

        // Filter and rank items
        const validItems = potentialItems
            .filter(item => item.score > 3) // Only keep items with decent scores
            .sort((a, b) => b.score - a.score); // Sort by score

        // Add valid items to extracted data
        validItems.forEach(item => {
            extractedData.items.push({
                name: item.name,
                price: item.price,
                quantity: item.quantity
            });
        });

        // Remove duplicate items with enhanced logic
        extractedData.items = this.removeDuplicateItems(extractedData.items);
    }

    shouldSkipLine(line, lineIndex, allLines) {
        const lowerLine = line.toLowerCase();

        // Skip header lines
        if (this.isHeaderLine(line)) return true;

        // Skip total/summary lines
        if (this.isTotalLine(line)) return true;

        // Skip merchant info lines
        if (this.isMerchantInfoLine(line)) return true;

        // Skip very short lines (likely not items)
        if (line.trim().length < 3) return true;

        // Skip lines that are mostly numbers (likely IDs, dates, etc.)
        const numberRatio = (line.match(/\d/g) || []).length / line.length;
        if (numberRatio > 0.7) return true;

        // Skip lines with common non-item patterns
        const skipPatterns = [
            /^(date|time|bill|receipt|invoice|order|table|server|cashier)/i,
            /^(thank you|thanks|visit again|welcome)/i,
            /^(gst|vat|tax|service charge|tip)/i,
            /^(subtotal|total|amount|balance|change)/i,
            /^\d+\/\d+\/\d+/, // Date patterns
            /^\d{2}:\d{2}/, // Time patterns
        ];

        return skipPatterns.some(pattern => pattern.test(line));
    }

    scoreItemLine(line, lineIndex, allLines) {
        let score = 5; // Base score
        const lowerLine = line.toLowerCase();

        // Bonus for food/item-like terms
        const itemTerms = [
            ...this.indianFoodTerms,
            'coffee', 'tea', 'water', 'juice', 'soda', 'beer', 'wine',
            'starter', 'main', 'dessert', 'special', 'combo', 'meal',
            'plate', 'bowl', 'cup', 'glass', 'bottle', 'can',
            'veg', 'non-veg', 'chicken', 'mutton', 'fish', 'paneer'
        ];

        itemTerms.forEach(term => {
            if (lowerLine.includes(term)) score += 3;
        });

        // Bonus for quantity indicators
        if (/\d+\s*x\s*|\d+\s*qty|\d+\s*pc[s]?/i.test(line)) score += 4;

        // Bonus for reasonable line position (items usually in middle section)
        const totalLines = allLines.length;
        const relativePosition = lineIndex / totalLines;
        if (relativePosition > 0.2 && relativePosition < 0.8) score += 3;

        // Bonus for mixed alphanumeric content (typical of item descriptions)
        const hasLetters = /[a-zA-Z]/.test(line);
        const hasNumbers = /\d/.test(line);
        if (hasLetters && hasNumbers) score += 2;

        // Penalty for lines that look like addresses or contact info
        if (this.isAddressLine(line) || this.indianPatterns.phone.test(line)) score -= 10;

        return score;
    }

    selectBestPrice(prices, line) {
        if (prices.length === 1) return prices[0];

        const lowerLine = line.toLowerCase();

        // If line mentions total/amount, prefer higher price
        if (lowerLine.includes('total') || lowerLine.includes('amount')) {
            return Math.max(...prices);
        }

        // For item lines, prefer reasonable item prices
        const reasonablePrices = prices.filter(p => p >= 1 && p <= 2000);
        if (reasonablePrices.length > 0) {
            // Prefer prices that aren't too round (more likely to be actual prices)
            const nonRoundPrices = reasonablePrices.filter(p => p % 10 !== 0);
            if (nonRoundPrices.length > 0) {
                return nonRoundPrices[0];
            }
            return reasonablePrices[0];
        }

        return prices[0];
    }

    async extractTotalsAndCharges(lines, extractedData) {
        for (const line of lines) {
            const lowerLine = line.toLowerCase();
            const prices = this.extractPricesFromLine(line);

            if (prices.length === 0) continue;

            const price = Math.max(...prices);

            // Total amount
            if (this.indianPatterns.total.test(lowerLine)) {
                extractedData.total = Math.max(extractedData.total, price);
            }
            // Subtotal
            else if (this.indianPatterns.subtotal.test(lowerLine)) {
                extractedData.subtotal = Math.max(extractedData.subtotal, price);
            }
            // GST/Tax
            else if (this.indianPatterns.gst.test(lowerLine)) {
                extractedData.tax = Math.max(extractedData.tax, price);
            }
            // Service charge
            else if (this.indianPatterns.serviceCharge.test(lowerLine)) {
                extractedData.serviceCharge = Math.max(extractedData.serviceCharge, price);
            }
        }
    }

    validateAndFixData(extractedData) {
        // Calculate subtotal if missing
        if (extractedData.subtotal === 0 && extractedData.items.length > 0) {
            extractedData.subtotal = extractedData.items.reduce((sum, item) =>
                sum + (item.price * item.quantity), 0
            );
        }

        // Calculate total if missing
        if (extractedData.total === 0) {
            extractedData.total = extractedData.subtotal + extractedData.tax + extractedData.serviceCharge;
        }

        // If total is much different from calculated, trust the extracted total
        const calculatedTotal = extractedData.subtotal + extractedData.tax + extractedData.serviceCharge;
        if (Math.abs(extractedData.total - calculatedTotal) > extractedData.total * 0.1) {
            // Adjust tax if total seems correct but calculation is off
            if (extractedData.total > extractedData.subtotal) {
                const remainingAmount = extractedData.total - extractedData.subtotal - extractedData.serviceCharge;
                if (remainingAmount > 0) {
                    extractedData.tax = remainingAmount;
                }
            }
        }

        // Remove items with unrealistic prices
        extractedData.items = extractedData.items.filter(item =>
            item.price >= 1 && item.price <= 10000
        );

        // If no items found but we have a total, create a generic item
        if (extractedData.items.length === 0 && extractedData.total > 0) {
            extractedData.items.push({
                name: 'Bill Total',
                price: extractedData.total,
                quantity: 1
            });
        }
    }

    // Helper methods
    containsPrice(text) {
        return /₹\s*\d+(?:\.\d{2})?|\d+\.\d{2}/.test(text);
    }

    isHeaderLine(line) {
        const lowerLine = line.toLowerCase();
        return /^(item|description|qty|quantity|price|amount|total|s\.?no|sr\.?no)$/i.test(lowerLine) ||
            /bill|receipt|invoice|order/i.test(lowerLine);
    }

    isTotalLine(line) {
        return this.indianPatterns.total.test(line) ||
            this.indianPatterns.subtotal.test(line) ||
            this.indianPatterns.gst.test(line) ||
            this.indianPatterns.serviceCharge.test(line);
    }

    isMerchantInfoLine(line) {
        return this.indianPatterns.phone.test(line) ||
            this.indianPatterns.email.test(line) ||
            /address|location/i.test(line);
    }

    isAddressLine(line) {
        return this.indianPatterns.indianCities.test(line) ||
            /\b(road|street|avenue|lane|nagar|colony|sector|block|pin|pincode)\b/i.test(line) ||
            /\d{6}/.test(line); // PIN code
    }

    extractPricesFromLine(line) {
        // Enhanced price extraction for various formats with dynamic patterns
        const pricePatterns = [
            // Currency symbol with amount: ₹123, ₹123.45, ₹1,234.56
            /₹\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g,
            // Decimal amounts: 123.45, 1234.56
            /(?<!\d)(\d{1,4}\.\d{2})(?!\d)/g,
            // Indian comma format: 178,00 (meaning 178.00)
            /(?<!\d)(\d{2,3},\d{2})(?!\d)/g,
            // Whole numbers that could be prices (with context)
            /(?<!\d)(\d{1,5})(?!\d)/g,
            // Amount with Rs: Rs 123, Rs. 123.45
            /Rs\.?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi,
            // INR format: INR 123.45
            /INR\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/gi
        ];

        const allMatches = [];
        const lowerLine = line.toLowerCase();

        // Extract all potential price matches
        pricePatterns.forEach(pattern => {
            const matches = line.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    let numStr = match.replace(/₹|Rs\.?|INR|\s/gi, '');

                    // Handle comma decimal format (Indian style: 178,00 = 178.00)
                    if (numStr.includes(',') && numStr.split(',').length === 2) {
                        const parts = numStr.split(',');
                        if (parts[1].length === 2) {
                            // Indian decimal format
                            numStr = parts[0] + '.' + parts[1];
                        } else {
                            // Thousand separator format
                            numStr = numStr.replace(/,/g, '');
                        }
                    }

                    const price = parseFloat(numStr);
                    if (!isNaN(price) && price > 0) {
                        allMatches.push({
                            value: price,
                            original: match,
                            context: line,
                            hasSymbol: /₹|Rs|INR/i.test(match)
                        });
                    }
                });
            }
        });

        // Smart filtering based on context and patterns
        return this.filterAndRankPrices(allMatches, lowerLine);
    }

    filterAndRankPrices(priceMatches, contextLine) {
        if (priceMatches.length === 0) return [];

        // Score each price based on context and likelihood
        const scoredPrices = priceMatches.map(match => {
            let score = 0;
            const price = match.value;

            // Base score for having currency symbol
            if (match.hasSymbol) score += 10;

            // Context-based scoring
            if (contextLine.includes('total') || contextLine.includes('amount')) score += 15;
            if (contextLine.includes('fare') || contextLine.includes('price')) score += 12;
            if (contextLine.includes('subtotal') || contextLine.includes('net')) score += 8;
            if (contextLine.includes('tax') || contextLine.includes('gst')) score += 5;

            // Price range scoring (dynamic based on context)
            if (contextLine.includes('transport') || contextLine.includes('bus') || contextLine.includes('ticket')) {
                // Transportation context
                if (price >= 10 && price <= 2000) score += 8;
                if (price >= 50 && price <= 500) score += 5; // Sweet spot for Indian bus fares
                if (price < 10 || price > 5000) score -= 10; // Unlikely for transport
            } else {
                // General receipt context
                if (price >= 1 && price <= 10000) score += 5;
                if (price >= 10 && price <= 1000) score += 3; // Common range
                if (price > 50000) score -= 15; // Very high amounts are suspicious
            }

            // Decimal format bonus (more likely to be actual prices)
            if (price % 1 !== 0) score += 3;

            // Penalize very round numbers (might be quantities or IDs)
            if (price % 100 === 0 && price > 100) score -= 2;

            // Penalize numbers that look like dates, times, or IDs
            if (price >= 1000 && price <= 9999 && price % 1 === 0) score -= 5; // Could be year/ID
            if (price >= 100 && price <= 999 && contextLine.includes('no')) score -= 8; // Likely ID number

            return { ...match, score };
        });

        // Sort by score (highest first) and return values
        return scoredPrices
            .sort((a, b) => b.score - a.score)
            .filter(item => item.score > -5) // Filter out very low scores
            .map(item => item.value);
    }

    extractItemName(line, priceMatches) {
        let itemName = line;

        // Remove prices from the line
        for (const price of priceMatches) {
            itemName = itemName.replace(new RegExp(`₹?\\s*${price.toFixed(2)}|₹?\\s*${price}`), '');
        }

        // Remove quantity indicators
        itemName = itemName.replace(/\d+\s*x\s*|\d+\s*qty|\d+\s*pc[s]?/gi, '');

        return itemName.trim();
    }

    extractQuantity(line) {
        const qtyMatch = line.match(/(\d+)\s*(?:x|qty|pc[s]?|nos?)/i);
        return qtyMatch ? parseInt(qtyMatch[1]) : 1;
    }

    cleanMerchantName(name) {
        return name
            .replace(/\b(restaurant|hotel|cafe|bar|pub|dhaba|kitchen|foods?|corner|palace|garden|house|inn)\b/gi, '$1')
            .replace(/[^\w\s&'-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    removeDuplicateItems(items) {
        const seen = new Set();
        return items.filter(item => {
            const key = `${item.name.toLowerCase()}-${item.price}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    getEmptyReceiptData() {
        return {
            items: [],
            subtotal: 0,
            tax: 0,
            serviceCharge: 0,
            total: 0,
            merchantInfo: {
                name: null,
                address: null,
                phone: null,
                email: null,
                website: null,
                gstNumber: null
            }
        };
    }
}

module.exports = new AdvancedOCRService();