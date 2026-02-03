import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/db";
import Prediction from "@/app/lib/models/Prediction";
import axios from "axios";

const BASE_URL = "https://indialotteryapi.com/wp-json/klr/v1";

export async function POST() {
  try {
    await dbConnect();
    
    // Calculate "Tomorrow"
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().slice(0, 10);

    const existing = await Prediction.findOne({ date: tomorrowStr });
    if (existing) {
      return NextResponse.json({ 
        message: "Prediction for tomorrow already exists", 
        data: existing 
      });
    }

    // 1) Fetch historical data (last 100-200 draws)
    const { data: historyResp } = await axios.get(`${BASE_URL}/history`);
    let items = Array.isArray(historyResp) ? historyResp : (historyResp.items || historyResp.results || []);
    
    if (!items.length) {
      return NextResponse.json({ error: "No historical data found" }, { status: 404 });
    }

    // 2) Clean numbers and focus on 6-digit results
    const cleanedNumbers = items
      .map((it) => {
        const p = it.first_ticket || it.firstprize || it.first_ticket_number || it.mc;
        return p ? String(p).replace(/\D/g, "") : null;
      })
      .filter((n) => n && n.length >= 6);

    // Generic Positional Logic
    const getPositionalCombo = (nums, weightFunc = () => 1) => {
      const posFreq = Array.from({ length: 6 }, () => Array(10).fill(0));
      nums.forEach((n, idx) => {
        const s = n.slice(-6);
        const weight = weightFunc(idx, nums.length);
        for (let i = 0; i < 6; i++) {
          const d = parseInt(s[i], 10);
          if (!isNaN(d)) posFreq[i][d] += weight;
        }
      });
      let combo = "";
      for (let i = 0; i < 6; i++) {
        let max = -1, target = 0;
        posFreq[i].forEach((score, d) => { if (score > max) { max = score; target = d; } });
        combo += target;
      }
      return combo;
    };

    // 1) Hot-Positional (Long term)
    const hotCombo = getPositionalCombo(cleanedNumbers);

    // 2) Recent-Weighted (Exponential decay weight for older draws)
    const recentCombo = getPositionalCombo(cleanedNumbers, (idx) => Math.max(0.1, 1 - idx / 30));

    // 3) Cold-Gap (Longest Absence)
    const getColdCombo = (nums) => {
      let combo = "";
      for (let i = 0; i < 6; i++) {
        const lastSeen = Array(10).fill(Infinity);
        nums.forEach((n, idx) => {
          const s = n.slice(-6);
          const d = parseInt(s[i], 10);
          if (lastSeen[d] === Infinity) lastSeen[d] = idx;
        });
        // Find digit that was seen longest ago (max index)
        let maxIdx = -1, cold = 0;
        lastSeen.forEach((val, d) => { if (val > maxIdx && val !== Infinity) { maxIdx = val; cold = d; } });
        combo += cold;
      }
      return combo;
    };
    const coldCombo = getColdCombo(cleanedNumbers);

    // 4) Balanced-Mean (Digits appearing closest to 1/10 frequency)
    const getBalancedCombo = (nums) => {
      const total = nums.length;
      const targetFreq = total / 10;
      const posFreq = Array.from({ length: 6 }, () => Array(10).fill(0));
      nums.forEach(n => {
        const s = n.slice(-6);
        for (let i = 0; i < 6; i++) {
          const d = parseInt(s[i], 10);
          if (!isNaN(d)) posFreq[i][d]++;
        }
      });
      let combo = "";
      for (let i = 0; i < 6; i++) {
        let minDiff = Infinity, balanced = 0;
        posFreq[i].forEach((count, d) => {
          const diff = Math.abs(count - targetFreq);
          if (diff < minDiff) { minDiff = diff; balanced = d; }
        });
        combo += balanced;
      }
      return combo;
    };
    const balancedCombo = getBalancedCombo(cleanedNumbers);

    // 5) Delta-Pattern (Mathematical projection of differences)
    const getDeltaCombo = (nums) => {
      if (nums.length < 2) return "777777";
      let combo = "";
      for (let i = 0; i < 6; i++) {
        const deltas = [];
        for (let idx = 0; idx < nums.length - 1; idx++) {
          const d1 = parseInt(nums[idx].slice(-6)[i]);
          const d2 = parseInt(nums[idx+1].slice(-6)[i]);
          deltas.push((d1 - d2 + 10) % 10);
        }
        // Most common delta
        const deltaFreq = Array(10).fill(0);
        deltas.forEach(d => deltaFreq[d]++);
        let maxD = -1, bestDelta = 0;
        deltaFreq.forEach((c, d) => { if (c > maxD) { maxD = c; bestDelta = d; } });
        
        const lastDigit = parseInt(nums[0].slice(-6)[i]);
        combo += (lastDigit + bestDelta) % 10;
      }
      return combo;
    };
    const deltaCombo = getDeltaCombo(cleanedNumbers);

    // 6) Guessing Board (Permutations of Top 4 Digits)
    const getGuessingBoard = (nums) => {
      // Find top 4 overall most frequent digits
      const overallFreq = Array(10).fill(0);
      nums.forEach(n => {
        n.slice(-6).split('').forEach(d => overallFreq[parseInt(d)]++);
      });
      const topDigits = overallFreq
        .map((count, d) => ({ d, count }))
        .sort((a,b) => b.count - a.count)
        .slice(0, 4)
        .map(obj => obj.d);
      
      // Generate 4-digit permutations of these top digits
      // If we have less than 4 unique digits, fill with next best
      while(topDigits.length < 4) {
         // This edge case is rare with large dataset, but just in case
         topDigits.push(Math.floor(Math.random()*10)); 
      }
      
      const results = [];
      const permute = (arr, m = []) => {
        if (m.length === 4) {
          results.push(m.join(""));
        } else {
          for (let i = 0; i < arr.length; i++) {
            let curr = arr.slice();
            let next = curr.splice(i, 1);
            permute(curr.slice(), m.concat(next));
          }
        }
      };
      permute(topDigits);
      // Return a random subset of 12 permutations for display (like the image)
      return results.sort(() => 0.5 - Math.random()).slice(0, 12);
    };
    const guessingBoard = getGuessingBoard(cleanedNumbers);

    const saved = await Prediction.create({
      date: tomorrowStr,
      predictedNumbers: [hotCombo, recentCombo, coldCombo, balancedCombo, deltaCombo],
      guessingBoard: guessingBoard
    });

    return NextResponse.json({ 
      message: "Super-Ensemble prediction generated", 
      data: saved,
      strategies: ["Hot-Positional", "Recent-Weighted", "Cold-Gap", "Balanced-Mean", "Delta-Pattern"]
    });
  } catch (err) {
    console.error("Prediction Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
