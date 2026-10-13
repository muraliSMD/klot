import { NextResponse } from "next/server";
import axios from "axios";

export async function GET(request) {
    try {
        // Security: Verify CRON_SECRET if configured or check authorization
        const authHeader = request.headers.get("authorization");
        const cronHeader = request.headers.get("x-vercel-cron");
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret) {
            const isAuthorized = authHeader === `Bearer ${cronSecret}` || cronHeader === "1";
            if (!isAuthorized) {
                return NextResponse.json({ error: "Unauthorized cron access" }, { status: 401 });
            }
        }

        const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const res = await axios.post(`${baseUrl}/api/klr/generate-prediction`);
        return NextResponse.json({
            success: true,
            cronTriggeredAt: new Date().toISOString(),
            result: res.data
        });
    } catch (error) {
        console.error("Cron Execution Error:", error.message);
        return NextResponse.json({
            success: false,
            error: error.response?.data?.message || "Cron job execution failed"
        }, { status: error.response?.status || 500 });
    }
}

export async function POST(request) {
    return GET(request);
}
