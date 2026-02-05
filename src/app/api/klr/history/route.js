import { NextResponse } from "next/server";
import axios from "axios";

const BASE_URL = "https://indialotteryapi.com/wp-json/klr/v1";

export async function GET() {
  try {
    const { data } = await axios.get(`${BASE_URL}/history?limit=1000`);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
