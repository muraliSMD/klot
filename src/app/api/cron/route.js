import { NextResponse } from "next/server";
import axios from "axios";

export async function GET(request) {
    try {
        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const res = await axios.post(`${baseUrl}/api/klr/generate-prediction`);
        return NextResponse.json({
            success: true,
            cronTriggeredAt: new Date().toISOString(),
            result: res.data
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error.response?.data?.message || error.message
        }, { status: error.response?.status || 500 });
    }
}

export async function POST(request) {
    return GET(request);
}
