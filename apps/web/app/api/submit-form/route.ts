// app/api/submit-form/route.ts
import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/db/connectDB";
import WaitList from "@/models/WaitList";

export async function POST(req: NextRequest) {
  try {
    console.log("🚀 API route /api/submit-form called");
    
    // Connect to MongoDB
    await connectDB();
    
    // Parse request body
    const { formData } = await req.json();
    // console.log("📦 Received data:", { formData });
    
    if (!formData) {
      return NextResponse.json(
        { success: false, message: "No form data provided" },
        { status: 400 }
      );
    }
    
    console.log("🔄 Processing form data:", formData);
    
    // Extract email from form data
    const email = formData["Share your email to save your journey and receive tailored insights"];
    // console.log("📧 Email extracted:", email);
    
    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log("❌ Invalid email format:", email);
      return NextResponse.json(
        { success: false, message: "Invalid email format" },
        { status: 400 }
      );
    }
    
    // Log each question/answer for debugging
    Object.entries(formData).forEach(([question, answer]) => {
      // console.log(`🔹 Processing question: "${question}" with answer:`, answer);
    });
    
    // Check if user with this email already exists
    console.log(`🔍 Looking for existing user with email: ${email}`);
    const existingUser = await (WaitList as any).findOne({ email: email.toLowerCase().trim() });
    
    if (existingUser) {
      // console.log(`🚫 User already exists with email: ${email}`);
      // console.log(`📅 Existing user created at: ${existingUser.createdAt}`);
      // console.log(`🆔 Existing user ID: ${existingUser.userWaitlistId}`);
      
      // Return error for duplicate submission
      return NextResponse.json(
        { 
          success: false, 
          message: "This email is already registered. You cannot submit the form again.",
          error: "Duplicate email submission blocked"
        },
        { status: 409 } // 409 Conflict status code
      );
    }
    
    // console.log(`✨ Creating new user: ${email}`);
    
    // Create new user with automatically generated userWaitlistId
    const newUser = new WaitList({
      email: email.toLowerCase().trim(),
      formResponses: formData
    });
    
    const result = await newUser.save();
    
    // console.log("✅ Form data saved successfully");
    // console.log("👤 New user details:", {
    //   id: result._id,
    //   email: result.email,
    //   userWaitlistId: result.userWaitlistId,
    //   createdAt: result.createdAt
    // });
    
    return NextResponse.json({
      success: true,
      message: "Form submitted successfully",
      userId: result._id,
      userWaitlistId: result.userWaitlistId
    });
    
  } catch (error: any) {
    // console.error("💥 Error processing form submission:", error);
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      // console.log("🔒 MongoDB duplicate key error - email already exists");
      return NextResponse.json(
        { 
          success: false,
          message: "This email is already registered. You cannot submit the form again.",
          error: "Duplicate email submission blocked"
        },
        { status: 409 }
      );
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      // console.log("📝 MongoDB validation error:", error.errors);
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        { 
          success: false,
          message: "Validation failed",
          error: validationErrors.join(', ')
        },
        { status: 400 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      {
        success: false,
        message: "Error submitting form",
        error: errorMessage
      },
      { status: 500 }
    );
  }
}