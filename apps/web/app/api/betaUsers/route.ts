// app/api/betaUsers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import BetaUsers from "@/models/Beta-Users"
import connectDB from "@/db/connectDB"

export async function POST(request: NextRequest) {
  try {
    // Connect to database
    await connectDB()
    
    const { email } = await request.json()

    // Validate email format
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required', hasAccess: false },
        { status: 400 }
      )
    }


    //later we update this api with supabase 

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format', hasAccess: false },
        { status: 400 }
      )
    }

    // Check if email exists in beta users collection
    // Cast model to any to avoid incompatible overloaded TypeScript signatures
    const betaUser = await (BetaUsers as any).findOne({
      email: email.toLowerCase().trim()
    })

    if (betaUser) {
      return NextResponse.json({
        hasAccess: true,
        message: 'Congratulations! You have beta access to Force.',
        email: email,
        joinedAt: betaUser.createdAt
      })
    } else {
      return NextResponse.json({
        hasAccess: false,
        message: "You're not on the beta access list yet. Don't worry - we'll notify you as soon as spots open up!",
        email: email
      })
    }
  } catch (error) {
    console.error('Error checking beta access:', error)
    return NextResponse.json(
      { error: 'Internal server error', hasAccess: false },
      { status: 500 }
    )
  }
}

