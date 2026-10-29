// // app/api/check-email/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import connectDB from "@/db/connectDB";
// import WaitList from "@/models/WaitList";

// export async function POST(request: NextRequest) {
//   try {
//     // Connect to the database
//     await connectDB();

//     // Parse the request body
//     const { email } = await request.json();

//     // Validate email presence
//     if (!email) {
//       return NextResponse.json(
//         { error: "Email is required" },
//         { status: 400 }
//       );
//     }

//     // Validate email format
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email)) {
//       return NextResponse.json(
//         { error: "Invalid email format" },
//         { status: 400 }
//       );
//     }

//     // Check if user already exists
//     const existingUser = await WaitList.findOne({ 
//       email: email.toLowerCase().trim() 
//     } as any).exec();

//     if (existingUser) {
//       return NextResponse.json(
//         { 
//           exists: true, 
//           message: "This email is already registered. You cannot submit the form again." 
//         },
//         { status: 409 } // 409 Conflict status code
//       );
//     }

//     // Email doesn't exist
//     return NextResponse.json(
//       { 
//         exists: false, 
//         message: "Email is available" 
//       },
//       { status: 200 }
//     );

//   } catch (error) {
//     console.error("Email check error:", error);
//     return NextResponse.json(
//       { error: "Internal server error" },
//       { status: 500 }
//     );
//   }
// }

// // Optional: Add GET method to check email via query parameter
// export async function GET(request: NextRequest) {
//   try {
//     await connectDB();

//     const { searchParams } = new URL(request.url);
//     const email = searchParams.get('email');

//     if (!email) {
//       return NextResponse.json(
//         { error: "Email parameter is required" },
//         { status: 400 }
//       );
//     }

//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email)) {
//       return NextResponse.json(
//         { error: "Invalid email format" },
//         { status: 400 }
//       );
//     }

//     const existingUser = await WaitList.findOne({ 
//       email: email.toLowerCase().trim() 
//     }).exec();

//     return NextResponse.json(
//       { 
//         exists: !!existingUser,
//         message: existingUser 
//           ? "This email is already registered" 
//           : "Email is available"
//       },
//       { status: 200 }
//     );

//   } catch (error) {
//     // console.error("Email check error:", error);
//     return NextResponse.json(
//       { error: "Internal server error" },
//       { status: 500 }
//     );
//   }
// }