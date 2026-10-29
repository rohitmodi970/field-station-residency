// models/User.ts
import mongoose, { Schema, Document } from "mongoose";
import { nanoid } from "nanoid";

// Define the interface for User documents
export interface IWaitList extends Document {
  email: string;
  userWaitlistId: string;
  formResponses: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Define the schema
const WaitListSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    userWaitlistId: {
      type: String,
      default: () => nanoid(10), // Generate a unique ID with nanoid
      unique: true,
      required: true,
    },
    formResponses: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: "wait_lists", // Explicitly set collection name to avoid issues
  }
);

// Export the model
// Check if the model already exists before creating a new one to prevent overwrite errors
export default mongoose.models.WaitList || mongoose.model<IWaitList>("WaitList", WaitListSchema);