import { NextResponse } from "next/server";
import axios from "axios";

const BASE_URL = "https://indialotteryapi.com/wp-json/klr/v1";

export async function GET() {
  try {
    const { data } = await axios.get(`${BASE_URL}/history?limit=1000`);
    const items = (data.items || []).map(it => ({
      ...it,
      name: it.draw_name,
      date: it.draw_date
    }));
    return NextResponse.json({ ...data, items });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
