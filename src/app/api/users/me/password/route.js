import { NextResponse } from "next/server";
import dbConnect from "@/app/lib/db";
import User from "@/app/lib/models/User";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
        return NextResponse.json(
            { error: "Password must be at least 6 characters long" },
            { status: 400 }
        );
    }

    await dbConnect();
    const user = await User.findById(decoded.id);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password. NOTE: User model should have a method for this, 
    // but we'll do it manually here if not present, assuming 'password' in DB is hashed.
    // However, usually we can't select 'password' if it's excluded by default in schema or query.
    // Let's re-fetch user WITH password.
    const userWithPassword = await User.findById(decoded.id).select("+password");

    const isMatch = await bcrypt.compare(currentPassword, userWithPassword.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    return NextResponse.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
