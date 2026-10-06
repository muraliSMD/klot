// Centralized High-Precision Kerala Lottery Prediction & Markov-Ensemble Engine

const getOfficialSeriesForLottery = (lotteryName = "", extractedSeriesList = []) => {
    const nameUpper = String(lotteryName).toUpperCase();
    
    const LOTTERY_SERIES_MAP = {
        'STHREE SAKTHI': ['SS', 'ST', 'SU', 'SV', 'SW', 'SX', 'SY', 'SZ', 'SA', 'SB', 'SC', 'SD'],
        'SAMRUDHI': ['AK', 'SM', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AJ', 'AK'],
        'AKSHAYA': ['AK', 'SM', 'AA', 'AB', 'AC', 'AD', 'AE', 'AF', 'AG', 'AH', 'AJ', 'AK'],
        'BHAGYATHARA': ['BT', 'WW', 'FF', 'FA', 'FB', 'FC', 'FD', 'FE', 'FG', 'FH', 'FJ', 'FK'],
        'WIN-WIN': ['W', 'WW', 'WA', 'WB', 'WC', 'WD', 'WE', 'WF', 'WG', 'WH', 'WJ', 'WK'],
        'DHANALEKSHMI': ['DL', 'FF', 'DA', 'DB', 'DC', 'DD', 'DE', 'DF', 'DG', 'DH', 'DJ', 'DK'],
        'FIFTY-FIFTY': ['FF', 'FA', 'FB', 'FC', 'FD', 'FE', 'FG', 'FH', 'FJ', 'FK', 'FL', 'FM'],
        'KARUNYA PLUS': ['KP', 'KN', 'PA', 'PB', 'PC', 'PD', 'PE', 'PF', 'PG', 'PH', 'PJ', 'PK'],
        'SUVARNA KERALAM': ['SK', 'NR', 'NA', 'NB', 'NC', 'ND', 'NE', 'NF', 'NG', 'NH', 'NJ', 'NK'],
        'NIRMAL': ['NR', 'SK', 'NA', 'NB', 'NC', 'ND', 'NE', 'NF', 'NG', 'NH', 'NJ', 'NK'],
        'KARUNYA': ['KA', 'KR', 'KB', 'KC', 'KD', 'KE', 'KF', 'KG', 'KH', 'KJ', 'KK', 'KL']
    };

    let matchedOfficial = [];
    for (const [key, seriesArr] of Object.entries(LOTTERY_SERIES_MAP)) {
        if (nameUpper.includes(key)) {
            matchedOfficial = seriesArr;
            break;
        }
    }

    const combined = [];
    extractedSeriesList.forEach(s => {
        if (s && /^[A-Z]{2}$/i.test(s) && !combined.includes(s.toUpperCase())) {
            combined.push(s.toUpperCase());
        }
    });

    matchedOfficial.forEach(s => {
        if (!combined.includes(s)) combined.push(s);
    });

    return combined.length > 0 ? combined : ['KL', 'KA', 'KB', 'KC', 'KD'];
};

const analyzePositionalMarkov = (drawList, targetLotteryName = "") => {
    const validDraws = (drawList || []).filter(d => {
        if (!d) return false;
        const t = d.first_ticket || d.result || (d.mc && d.mc[0]);
        return t && /\d/.test(t);
    });

    // 6 Positional digit scores (Pos 0 to 5)
    const pos6DScores = Array.from({ length: 6 }, () => ({0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0}));

    const markovTransitions = [
        Array.from({length: 10}, () => Array(10).fill(0)),
        Array.from({length: 10}, () => Array(10).fill(0)),
        Array.from({length: 10}, () => Array(10).fill(0))
    ];

    const seriesCounts = {};
    const limit = Math.min(validDraws.length, 100);

    for (let i = 0; i < limit; i++) {
        const item = validDraws[i];
        const rawTicket = (item.first_ticket || item.result || (item.mc && item.mc[0]) || "").toString();
        const drawName = (item.draw_name || item.name || "").toString();

        const seriesMatch = rawTicket.match(/([A-Z]{2})/i) || drawName.match(/([A-Z]{2})/i);
        if (seriesMatch) {
            const s = seriesMatch[1].toUpperCase();
            if (!["NO", "ID", "IN", "IS", "KL"].includes(s)) {
                seriesCounts[s] = (seriesCounts[s] || 0) + (1.5 / (i + 1));
            }
        }

        const digits3 = rawTicket.replace(/\D/g, '').slice(-3);
        const digits6 = rawTicket.replace(/\D/g, '').slice(-6).padStart(6, '0');

        const weight = Math.pow(0.96, i);

        if (digits6.length === 6) {
            for (let pos = 0; pos < 6; pos++) {
                const digit = parseInt(digits6[pos], 10);
                pos6DScores[pos][digit] += weight;
            }
        }

        if (digits3.length === 3) {
            const d0 = parseInt(digits3[0], 10);
            const d1 = parseInt(digits3[1], 10);
            const d2 = parseInt(digits3[2], 10);

            if (i < limit - 1) {
                const prevTicket = (validDraws[i+1].first_ticket || validDraws[i+1].result || (validDraws[i+1].mc && validDraws[i+1].mc[0]) || "").toString();
                const prevDigits = prevTicket.replace(/\D/g, '').slice(-3);
                if (prevDigits.length === 3) {
                    markovTransitions[0][parseInt(prevDigits[0], 10)][d0] += weight;
                    markovTransitions[1][parseInt(prevDigits[1], 10)][d1] += weight;
                    markovTransitions[2][parseInt(prevDigits[2], 10)][d2] += weight;
                }
            }
        }
    }

    const pos1Board = Object.entries(pos6DScores[0]).sort(([,a], [,b]) => b - a).map(([d]) => d);
    const pos2Board = Object.entries(pos6DScores[1]).sort(([,a], [,b]) => b - a).map(([d]) => d);
    const pos3Board = Object.entries(pos6DScores[2]).sort(([,a], [,b]) => b - a).map(([d]) => d);
    const aBoard = Object.entries(pos6DScores[3]).sort(([,a], [,b]) => b - a).map(([d]) => d);
    const bBoard = Object.entries(pos6DScores[4]).sort(([,a], [,b]) => b - a).map(([d]) => d);
    const cBoard = Object.entries(pos6DScores[5]).sort(([,a], [,b]) => b - a).map(([d]) => d);

    const extractedSeriesList = Object.entries(seriesCounts).sort(([,a], [,b]) => b - a).map(([s]) => s);
    const officialSeriesList = getOfficialSeriesForLottery(targetLotteryName || (validDraws[0]?.draw_name || ""), extractedSeriesList);

    return {
        posScores: [pos6DScores[3], pos6DScores[4], pos6DScores[5]],
        pos6DScores,
        markovTransitions,
        pos1Board,
        pos2Board,
        pos3Board,
        aBoard,
        bBoard,
        cBoard,
        officialSeriesList
    };
};

const generateSmartMatrix = (seed3, historyList = [], markovData = null) => {
    const seed = parseInt(seed3, 10);
    const candidates = new Set();
    
    [-3, -2, -1, 0, 1, 2, 3].forEach(d => candidates.add((seed + d + 1000) % 1000));
    const mirror = seed3.split('').map(d => (parseInt(d, 10) + 5) % 10).join('');
    candidates.add(parseInt(mirror, 10));
    candidates.add((seed + 111) % 1000);
    candidates.add((seed + 889) % 1000);
    
    const targetSum = seed3.split('').reduce((a, b) => a + parseInt(b, 10), 0);
    let found = 0;
    for (let i = 0; i < 1000; i++) {
        if (found >= 3) break;
        const s = i.toString().padStart(3, '0');
        const sum = s.split('').reduce((a, b) => a + parseInt(b, 10), 0);
        if (sum === targetSum && i !== seed) {
            candidates.add(i);
            found++;
        }
    }
    
    if (markovData) {
        markovData.aBoard.slice(0, 3).forEach(d1 => {
            markovData.bBoard.slice(0, 3).forEach(d2 => {
                markovData.cBoard.slice(0, 3).forEach(d3 => {
                    candidates.add(parseInt(`${d1}${d2}${d3}`, 10));
                });
            });
        });
    }
    
    return Array.from(candidates).map(n => n.toString().padStart(3, '0')).slice(0, 20);
};

export const getWinningNumber = (draw) => {
    if (!draw) return null;
    if (typeof draw.first_ticket === "string" && draw.first_ticket.trim().length > 0 && /\d/.test(draw.first_ticket)) return draw.first_ticket.trim();
    if (typeof draw.result === "string" && draw.result.trim().length > 0 && /\d/.test(draw.result)) return draw.result.trim();
    if (draw.mc && Array.isArray(draw.mc) && draw.mc.length > 0 && typeof draw.mc[0] === "string") return draw.mc[0].trim();
    return null;
};

export const getLastMonthSameDayDraw = (validDraws = [], targetDateObj = new Date()) => {
    if (!validDraws || validDraws.length === 0) return null;
    
    const targetTime = targetDateObj ? new Date(targetDateObj).getTime() : Date.now();
    
    // Search for a draw ~25 to 35 days prior to targetDateObj
    for (let i = 1; i < validDraws.length; i++) {
        const item = validDraws[i];
        const dateStr = item.draw_date || item.date;
        if (dateStr) {
            const itemTime = new Date(dateStr).getTime();
            if (!isNaN(itemTime)) {
                const diffDays = Math.round((targetTime - itemTime) / (24 * 60 * 60 * 1000));
                if (diffDays >= 25 && diffDays <= 35) {
                    const ticket = getWinningNumber(item);
                    const seriesMatch = ticket?.match(/([A-Z]{2})/i) || (item.draw_name || item.name || "").match(/([A-Z]{2})/i);
                    const series = seriesMatch ? seriesMatch[1].toUpperCase() : "KL";
                    const numeric = ticket ? ticket.replace(/\D/g, "") : "";
                    return {
                        draw_name: item.draw_name || item.name || "Last Month Draw",
                        date: dateStr,
                        ticket: ticket,
                        series: series,
                        numeric: numeric,
                        last3: numeric.slice(-3),
                        diffDays: diffDays
                    };
                }
            }
        }
    }
    
    // Fallback: Use 4th draw in validDraws (4 weeks ago for weekly lottery draws)
    const fallbackItem = validDraws[Math.min(4, validDraws.length - 1)];
    const fallbackTicket = getWinningNumber(fallbackItem);
    if (fallbackItem && fallbackTicket) {
        const seriesMatch = fallbackTicket.match(/([A-Z]{2})/i) || (fallbackItem.draw_name || fallbackItem.name || "").match(/([A-Z]{2})/i);
        const series = seriesMatch ? seriesMatch[1].toUpperCase() : "KL";
        const numeric = fallbackTicket.replace(/\D/g, "");
        return {
            draw_name: fallbackItem.draw_name || fallbackItem.name || "Last Month Draw",
            date: fallbackItem.draw_date || fallbackItem.date || "",
            ticket: fallbackTicket,
            series: series,
            numeric: numeric,
            last3: numeric.slice(-3),
            diffDays: 28
        };
    }
    
    return null;
};

export const generateFromList = (drawList, dateObj, algorithmStats = [], aiPrediction = null) => {
    if (!drawList || drawList.length < 1) return null;

    const validDraws = drawList.filter(d => getWinningNumber(d) !== null);
    if (validDraws.length < 1) return null;

    const latestDraw = validDraws[0]; 
    const previousDraw = validDraws[1];

    const winningNumber = getWinningNumber(latestDraw);
    if (!winningNumber) return null;

    const seedDraw = {
        draw_name: latestDraw.draw_name || latestDraw.name || "Lottery Draw",
        draw_date: latestDraw.draw_date || latestDraw.date || "",
        ticket: winningNumber
    };

    // Extract Last Month Same Day Draw
    const lastMonthDraw = getLastMonthSameDayDraw(validDraws, dateObj);
    
    const numericPart = winningNumber.replace(/\D/g, ''); 
    let trend = numericPart.split('').map(() => 1);

    const prevWinning = getWinningNumber(previousDraw);
    if (previousDraw && prevWinning) {
        const prevNumeric = prevWinning.replace(/\D/g, '');
        if (prevNumeric.length === numericPart.length) {
            trend = numericPart.split('').map((d, i) => (parseInt(d, 10) - parseInt(prevNumeric[i], 10) + 10) % 10);
        }
    }

    const applyShift = (numStr, shiftArr) => {
        return numStr.split('').map((d, i) => (parseInt(d, 10) + (shiftArr[i] || 0)) % 10).join('');
    };

    const algo1 = applyShift(numericPart, trend);
    let velocityTrend = [...trend];
    if (validDraws[2]) {
        const d2 = getWinningNumber(validDraws[1])?.replace(/\D/g, '');
        const d3 = getWinningNumber(validDraws[2])?.replace(/\D/g, '');
        if (d2 && d3 && d2.length === d3.length) {
            const trend2 = d2.split('').map((d, i) => (parseInt(d, 10) - parseInt(d3[i], 10) + 10) % 10);
            velocityTrend = trend.map((t, i) => Math.round((t + trend2[i]) / 2));
        }
    }
    const algo2 = applyShift(numericPart, velocityTrend);
    const algo3 = algo1.split('').map(d => (parseInt(d, 10) + 5) % 10).join('');
    const dayOfMonth = dateObj ? dateObj.getUTCDate() : new Date().getUTCDate();
    const algo4 = algo1.split('').map(d => (parseInt(d, 10) + dayOfMonth) % 10).join('');
    const algo5 = applyShift(numericPart, [3, 0, 4, 9, 4, 6]);
    const dayIndex = dateObj ? dateObj.getUTCDay() : new Date().getUTCDay();
    const algo6 = applyShift(numericPart, [dayIndex, (dayIndex + 2) % 10, (dayIndex + 5) % 10, dayIndex, (dayIndex + 3) % 10, (dayIndex + 7) % 10]);
    const algo7 = applyShift(numericPart, [1, 1, 1, 1, 1, 1]);

    const first3 = numericPart.slice(0, 3);
    const last3 = numericPart.slice(-3);
    const trendFirst3 = trend.slice(0, 3);
    const trendLast3 = trend.slice(-3);
    const algo8 = applyShift(first3, trendFirst3) + applyShift(last3, trendLast3);

    const targetLotteryName = latestDraw.draw_name || latestDraw.name || "";
    const markovData = analyzePositionalMarkov(validDraws, targetLotteryName);
    const { officialSeriesList, pos1Board, pos2Board, pos3Board, aBoard, bBoard, cBoard } = markovData;

    // Calculate Last Month Shift Algorithm
    let algo3D_LastMonth = last3;
    if (lastMonthDraw && lastMonthDraw.last3 && lastMonthDraw.last3.length === 3) {
        algo3D_LastMonth = applyShift(lastMonthDraw.last3, trendLast3);
    }

    const hotFirstDigit = aBoard[0] || first3[0];
    const algo9 = (hotFirstDigit + first3.slice(1)) + last3;

    const digitArray = last3.split('').map(Number);
    const algo3D_1 = last3;
    const algo3D_2 = last3.split('').reverse().join('');
    const algo3D_3 = digitArray.map(d => 9 - d).join('');
    const algo3D_4 = digitArray.map(d => (d + 1) % 10).join('');
    const algo3D_5 = digitArray.map(d => (d - 1 + 10) % 10).join('');
    const algo3D_6 = digitArray.map(d => (d + 5) % 10).join('');
    const algo3D_7 = digitArray.map(d => (d + 2) % 10).join('');
    const algo3D_8 = (aBoard[0] || ((digitArray[0]+5)%10)) + last3.slice(1);
    const algo3D_9 = last3.slice(-1) + last3.slice(0, 2); 
    const algo3D_10 = `${(digitArray[0] + trendLast3[0]) % 10}${digitArray[1]}${(digitArray[2] + trendLast3[2]) % 10}`;
    const algo3D_11 = `${(digitArray[0] + trendLast3[0]) % 10}${(digitArray[1] + trendLast3[1]) % 10}${digitArray[2]}`;
    const algo3D_12 = digitArray.map((d, i) => (i === 1 ? d : (d - 2 + 10) % 10)).join('');
    const algo3D_13 = digitArray.map(d => 9 - d).join('');
    const algo3D_14 = digitArray.map((d, i) => (i === 1 ? d : (d + 5) % 10)).join('');
    const algo3D_15 = digitArray.map((d, i) => (i === 1 ? (d + 5) % 10 : d)).join('');
    const algo3D_16 = digitArray.map(d => (d + 1) % 10).join('');
    
    const getPositionalMedian = (dl) => {
        const dgs = [[], [], []];
        const lim = Math.min(dl.length, 10);
        for(let i=0; i<lim; i++) {
            const n = getWinningNumber(dl[i])?.replace(/\D/g, '').slice(-3);
            if(n?.length === 3) {
                dgs[0].push(parseInt(n[0], 10)); dgs[1].push(parseInt(n[1], 10)); dgs[2].push(parseInt(n[2], 10));
            }
        }
        return dgs.map(pos => pos.length === 0 ? 5 : pos.sort((a,b)=>a-b)[Math.floor(pos.length/2)]);
    };
    const algo3D_17 = getPositionalMedian(validDraws).join('');

    const allCandidates = [
        algo1.slice(-3), algo2.slice(-3), algo3.slice(-3), algo4.slice(-3), algo5.slice(-3), algo6.slice(-3), algo7.slice(-3), algo8.slice(-3), algo9.slice(-3),
        algo3D_1, algo3D_2, algo3D_3, algo3D_4, algo3D_5, algo3D_6, algo3D_7, algo3D_8, algo3D_9, algo3D_10, algo3D_11, algo3D_12, algo3D_13, algo3D_14, algo3D_15, algo3D_16, algo3D_17
    ];

    const candidateScores = {};
    const last3Digits = last3.split('').map(Number);

    // Near-Hit Proximity Generator (±1 shift on A, B, C positions for high-precision matching)
    const generateNearHitVariants = (threeDigitStr) => {
        if (!threeDigitStr || threeDigitStr.length !== 3) return [];
        const d = threeDigitStr.split('').map(Number);
        const variants = new Set();
        [-1, 1].forEach(delta => {
            variants.add(`${(d[0] + delta + 10) % 10}${d[1]}${d[2]}`);
            variants.add(`${d[0]}${(d[1] + delta + 10) % 10}${d[2]}`);
            variants.add(`${d[0]}${d[1]}${(d[2] + delta + 10) % 10}`);
        });
        return Array.from(variants);
    };

    aBoard.slice(0, 5).forEach(a => {
        bBoard.slice(0, 5).forEach(b => {
            cBoard.slice(0, 5).forEach(c => {
                const num = `${a}${b}${c}`;
                const da = parseInt(a, 10), db = parseInt(b, 10), dc = parseInt(c, 10);
                
                let score = markovData.posScores[0][da] * 1.5 +
                            markovData.posScores[1][db] * 1.5 +
                            markovData.posScores[2][dc] * 1.5 +
                            markovData.markovTransitions[0][last3Digits[0]][da] +
                            markovData.markovTransitions[1][last3Digits[1]][db] +
                            markovData.markovTransitions[2][last3Digits[2]][dc];

                candidateScores[num] = score;
            });
        });
    });

    allCandidates.forEach(num => {
        if (num && num.length === 3) {
            candidateScores[num] = (candidateScores[num] || 0) + 3.0;
            // Add near-hit proximity candidates
            const nearHits = generateNearHitVariants(num);
            nearHits.forEach(nh => {
                candidateScores[nh] = (candidateScores[nh] || 0) + 1.5;
            });
        }
    });

    const aiNum = aiPrediction?.predictedNumber?.slice(-3);
    if (aiNum && aiNum.length === 3) {
        candidateScores[aiNum] = (candidateScores[aiNum] || 0) + 8.0;
        const aiNearHits = generateNearHitVariants(aiNum);
        aiNearHits.forEach(nh => {
            candidateScores[nh] = (candidateScores[nh] || 0) + 4.0;
        });
    }

    if (algorithmStats && Array.isArray(algorithmStats)) {
        algorithmStats.forEach(stat => {
            if (stat.hits > 0) {
                if (stat.algoKey === "Flow Pair (Fix)" && candidateScores[algo3D_8]) candidateScores[algo3D_8] += (stat.hits * 0.5);
                if (stat.algoKey === "Repeat Middle" && candidateScores[algo3D_10]) candidateScores[algo3D_10] += (stat.hits * 0.5);
            }
        });
    }

    const sortedConsensus = Object.entries(candidateScores)
        .sort(([, a], [, b]) => b - a)
        .map(([num]) => num);

    const topThree = sortedConsensus.slice(0, 3);

    const getPermutations = (numStr) => {
        if (!numStr || numStr.length !== 3) return [numStr];
        const chars = numStr.split('');
        const perms = new Set();
        perms.add(`${chars[0]}${chars[1]}${chars[2]}`);
        perms.add(`${chars[0]}${chars[2]}${chars[1]}`);
        perms.add(`${chars[1]}${chars[0]}${chars[2]}`);
        perms.add(`${chars[1]}${chars[2]}${chars[0]}`);
        perms.add(`${chars[2]}${chars[0]}${chars[1]}`);
        perms.add(`${chars[2]}${chars[1]}${chars[0]}`);
        return Array.from(perms);
    };

    const boxedSet = new Set();
    topThree.forEach(num => {
        getPermutations(num).forEach(p => boxedSet.add(p));
    });
    const boxedPermutations = Array.from(boxedSet).slice(0, 10);

    const abPairs = [];
    aBoard.slice(0, 3).forEach(a => bBoard.slice(0, 3).forEach(b => abPairs.push(`${a}${b}`)));
    
    const bcPairs = [];
    bBoard.slice(0, 3).forEach(b => cBoard.slice(0, 3).forEach(c => bcPairs.push(`${b}${c}`)));

    const acPairs = [];
    aBoard.slice(0, 3).forEach(a => cBoard.slice(0, 3).forEach(c => acPairs.push(`${a}${c}`)));

    // Generate 10-ticket C-Board Full Coverage Set (C = 0..9) with top A and B board digits
    const cCoverageSet = [];
    const topA = aBoard.slice(0, 4);
    const topB = bBoard.slice(0, 4);
    const topC = cBoard.slice(0, 4);

    for (let c = 0; c <= 9; c++) {
        const aDigit = topA[c % topA.length] || "5";
        const bDigit = topB[Math.floor(c / 2) % topB.length] || "0";
        const cDigit = c.toString();
        cCoverageSet.push(`${aDigit}${bDigit}${cDigit}`);
    }

    // Generate BC Both Pool Predictions
    const bcPairScores = {};

    topB.forEach(b => {
        topC.forEach(c => {
            const pair = `${b}${c}`;
            const db = parseInt(b, 10), dc = parseInt(c, 10);
            let score = (markovData.posScores[1][db] * 1.5) + (markovData.posScores[2][dc] * 1.5);
            bcPairScores[pair] = score;
        });
    });

    // Add BC pairs from top 3D candidates
    allCandidates.forEach(num => {
        if (num && num.length >= 2) {
            const bc = num.slice(-2);
            bcPairScores[bc] = (bcPairScores[bc] || 0) + 2.5;
        }
    });

    const sortedBcPairs = Object.entries(bcPairScores)
        .sort(([, a], [, b]) => b - a)
        .map(([pair]) => pair);

    const topBcPairs = Array.from(new Set(sortedBcPairs)).slice(0, 10);

    // BC Both Pool 10-Ticket Pair Guarantee Set
    const bcPoolSet = topBcPairs.map((pair, idx) => {
        const aDigit = topA[idx % topA.length] || "5";
        return {
            pair: pair,
            fullTicket: `${aDigit}${pair}`,
            confidence: Math.max(70, Math.min(98, 98 - (idx * 3)))
        };
    });

    const abcBoard = {
        aBoard: aBoard.slice(0, 4),
        bBoard: bBoard.slice(0, 4),
        cBoard: cBoard.slice(0, 4),
        abPairs: Array.from(new Set(abPairs)).slice(0, 8),
        bcPairs: Array.from(new Set(bcPairs)).slice(0, 8),
        acPairs: Array.from(new Set(acPairs)).slice(0, 8),
        singleDigit: aBoard[0] || "5",
        cCoverageSet: cCoverageSet,
        topBcPairs: topBcPairs,
        bcPoolSet: bcPoolSet
    };

    // Generate 5 High-Precision 6-Digit Tickets matching official series codes dynamically
    const fullTickets = [];
    const lead3D = `${pos1Board[0] || numericPart[0] || "6"}${pos2Board[0] || numericPart[1] || "3"}${pos3Board[0] || numericPart[2] || "5"}`;
    const lead3D_Alt = `${pos1Board[1] || "8"}${pos2Board[1] || "9"}${pos3Board[1] || "2"}`;

    const series1 = officialSeriesList[0] || "KL";
    const series2 = officialSeriesList[1] || officialSeriesList[0] || "KA";
    const series3 = officialSeriesList[2] || officialSeriesList[0] || "KB";
    const series4 = officialSeriesList[3] || officialSeriesList[0] || "KC";

    // Ticket 1: Master Positional 6D Ticket
    const ticket1_Num = numericPart.length >= 6 ? (lead3D + topThree[0]) : (numericPart.slice(0, 3) + topThree[0]);
    fullTickets.push(`${series1} ${ticket1_Num}`);

    // Ticket 2: 6D Linear Shifted Trend Ticket
    const ticket2_Num = algo1.length >= 6 ? algo1.slice(-6) : (lead3D_Alt + (topThree[1] || topThree[0]));
    fullTickets.push(`${series2} ${ticket2_Num}`);

    // Ticket 3: 6D Velocity Trend Shift Ticket
    const ticket3_Num = algo2.length >= 6 ? algo2.slice(-6) : (algo8.slice(0, 3) + (topThree[2] || topThree[0]));
    fullTickets.push(`${series3} ${ticket3_Num}`);

    // Ticket 4: 6D Proximity Near-Hit Shift Ticket
    const ticket4_Num = applyShift(ticket1_Num, [0, 0, 0, 0, 0, 1]);
    fullTickets.push(`${series4} ${ticket4_Num}`);

    // Ticket 5: Last Month Same Day Series & Shift Ticket
    const lastMonthSeries = lastMonthDraw?.series || officialSeriesList[4] || officialSeriesList[0] || "KD";
    const ticket5_Num = lastMonthDraw?.numeric?.length >= 6 ? applyShift(lastMonthDraw.numeric.slice(-6), [0, 0, 0, 0, 0, 1]) : (lead3D_Alt + (topThree[0] || "895"));
    fullTickets.push(`${lastMonthSeries} ${ticket5_Num}`);

    const posMaster = `${aBoard[0] || "0"}${bBoard[0] || "0"}${cBoard[0] || "0"}`;
    const consensusMaster = sortedConsensus[0] || posMaster;
    
    let masterWinner = consensusMaster;
    const posScore = candidateScores[posMaster] || 0;
    const consensusScore = candidateScores[consensusMaster] || 0;
    
    if (posScore > consensusScore * 0.9) {
        masterWinner = posMaster;
    } else if (aiNum && aiNum.length === 3 && candidateScores[aiNum] > consensusScore * 0.8) {
        masterWinner = aiNum;
    }

    return {
        seedDraw: seedDraw,
        lastMonthDraw: lastMonthDraw,
        masterWinner: masterWinner,
        fullTickets: fullTickets,
        predictedNumbers: [algo1, algo2, algo3, algo4, algo5, algo6, algo7, algo8, algo9],
        topFive: topThree,
        boxedPermutations: boxedPermutations,
        abcBoard: abcBoard,
        algorithms: {
            "Linear Trend": algo1, "Average Velocity": algo2, "Mirror Pattern": algo3, "Date Flow": algo4, "Delta Pattern-A": algo5, "Smart Delta": algo6, "Neighbor Reach": algo7, "Split-Merge Trend": algo8, "Composite (Hot Series)": algo9
        },
        threeDigit: {
            "Direct": algo3D_1, "Reverse": algo3D_2, "Complement": algo3D_3, "Shift +1": algo3D_4, "Shift -1": algo3D_5, "Mirror": algo3D_6, "Key (+2)": algo3D_7, "Flow Pair (Fix)": algo3D_8, "Crossing": algo3D_9, "Repeat Middle": algo3D_10, "Repeat Last": algo3D_11, "Symmetric Drift": algo3D_12, "9-Complement": algo3D_13, "Mirror Outer": algo3D_14, "Mirror Inner": algo3D_15, "Sequence Flow": algo3D_16, "Position Median": algo3D_17
        },
        guessingBoard: [algo1.slice(-4), algo2.slice(-4), algo3.slice(-4), algo4.slice(-4), algo5.slice(-4), algo6.slice(-4), algo7.slice(-4), algo8.slice(-4), algo9.slice(-4)],
        poolAnalysis: {
            sum: last3.split('').reduce((a, b) => a + parseInt(b, 10), 0),
            zone: Math.floor(parseInt(last3, 10) / 200),
            hotStats: [aBoard.slice(0,2), bBoard.slice(0,2), cBoard.slice(0,2)],
            matrix: generateSmartMatrix(last3, validDraws, markovData)
        }
    };
};
