"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle, Mail, Users, Bell } from "lucide-react";
import { useRouter } from "next/navigation";

interface Particle {
    width: number;
    height: number;
    x: number;
    y: number;
    animateX: number[];
    animateY: number[];
    opacity: number[];
    duration: number;
}

const ConfirmationPage: React.FC = () => {
    const [particles, setParticles] = useState<Particle[]>([]);
    const router = useRouter();

    const handleGoBack = () => {
        router.push("/");
    };

    useEffect(() => {
        if (typeof window !== "undefined") {
            const newParticles = Array.from({ length: 25 }).map(() => ({
                width: Math.random() * 8 + 3,
                height: Math.random() * 8 + 3,
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                animateX: [
                    Math.random() * window.innerWidth,
                    Math.random() * window.innerWidth,
                    Math.random() * window.innerWidth,
                ],
                animateY: [
                    Math.random() * window.innerHeight,
                    Math.random() * window.innerHeight,
                    Math.random() * window.innerHeight,
                ],
                opacity: [0.1, 0.6, 0.1],
                duration: Math.random() * 20 + 20,
            }));
            setParticles(newParticles);
        }
    }, []);

    return (
        <motion.div
            id="confirmationPage"
            className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center overflow-hidden relative"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            {/* Enhanced animated background */}
            <motion.div className="absolute inset-0 z-0">
                <svg
                    viewBox="0 0 1000 1000"
                    xmlns="http://www.w3.org/2000/svg"
                    className="absolute inset-0 w-full h-full opacity-30"
                >
                    <defs>
                        <radialGradient id="gradient1" cx="30%" cy="30%" r="40%">
                            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.4" />
                            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                        </radialGradient>
                        <radialGradient id="gradient2" cx="70%" cy="70%" r="35%">
                            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                        </radialGradient>
                    </defs>
                    <rect x="0" y="0" width="100%" height="100%" fill="url(#gradient1)" />
                    <rect x="0" y="0" width="100%" height="100%" fill="url(#gradient2)" />
                </svg>

                {/* Refined animated particles */}
                {particles.map((particle, i) => (
                    <motion.div
                        key={i}
                        className="absolute rounded-full blur-sm"
                        style={{
                            width: particle.width,
                            height: particle.height,
                            x: particle.x,
                            y: particle.y,
                            background: `linear-gradient(45deg, ${
                                i % 3 === 0 ? '#8B5CF6' : i % 3 === 1 ? '#3B82F6' : '#06B6D4'
                            }, transparent)`,
                        }}
                        animate={{
                            x: particle.animateX,
                            y: particle.animateY,
                            opacity: particle.opacity,
                        }}
                        transition={{
                            repeat: Infinity,
                            repeatType: "reverse",
                            duration: particle.duration,
                            ease: "easeInOut",
                        }}
                    />
                ))}
            </motion.div>

            {/* Main content container */}
            <div className="max-w-2xl mx-auto text-center px-6 z-10 relative">
                {/* Logo and brand section */}
                <motion.div
                    className="mb-8"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                        delay: 0.2,
                    }}
                >
                    <motion.div
                        className="mt-4"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <div className="relative inline-block">
                            <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 rounded-2xl blur-xl opacity-20"
                                animate={{
                                    scale: [1, 1.1, 1],
                                    opacity: [0.2, 0.4, 0.2],
                                }}
                                transition={{
                                    repeat: Infinity,
                                    duration: 3,
                                    ease: "easeInOut",
                                }}
                            />
                            <div className="flex items-center justify-center relative z-10">
                                <div className="relative">
                                    <motion.div
                                        className="absolute inset-0 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 rounded-full blur-lg opacity-30"
                                        animate={{
                                            scale: [1, 1.2, 1],
                                            opacity: [0.3, 0.5, 0.3],
                                        }}
                                        transition={{
                                            repeat: Infinity,
                                            duration: 3,
                                            ease: "easeInOut",
                                        }}
                                    />
                                    <img 
                                        src="/Logo-black.png" 
                                        alt="FORCE Logo - F" 
                                        className="w-16 h-16 md:w-20 md:h-20 relative z-10 drop-shadow-2xl"
                                    />
                                </div>
                                <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent ml-2">
                                    ORCE
                                </h1>
                            </div>
                        </div>
                        <motion.div
                            className="h-1 w-24 mx-auto bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 rounded-full mt-3"
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: "6rem", opacity: 1 }}
                            transition={{ delay: 0.7, duration: 0.8 }}
                        />
                    </motion.div>
                </motion.div>

                {/* Success icon and message */}
                <motion.div
                    className="mb-8"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                        delay: 0.8,
                    }}
                >
                    <div className="relative inline-block">
                        <motion.div
                            className="absolute inset-0 bg-green-500 rounded-full blur-lg opacity-30"
                            animate={{
                                scale: [1, 1.3, 1],
                                opacity: [0.3, 0.6, 0.3],
                            }}
                            transition={{
                                repeat: Infinity,
                                duration: 2,
                                ease: "easeInOut",
                            }}
                        />
                        <div className="bg-green-500/20 backdrop-blur-sm border border-green-500/30 rounded-full p-6">
                            <CheckCircle className="h-12 w-12 text-green-400 mx-auto" />
                        </div>
                    </div>
                </motion.div>

                {/* Main heading */}
                <motion.h2
                    className="text-3xl md:text-4xl font-bold text-white mb-4"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1.0 }}
                >
                    You're on the waitlist!
                </motion.h2>

                {/* Subheading */}
                <motion.p
                    className="text-lg text-gray-300 mb-8 max-w-lg mx-auto leading-relaxed"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1.2 }}
                >
                    Thank you for joining our waitlist. We'll notify you as soon as FORCE is ready to launch.
                </motion.p>

                {/* What's next section */}
                <motion.div
                    className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 mb-8"
                    initial={{ y: 30, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1.4 }}
                >
                    <h3 className="text-xl font-semibold text-white mb-4">What happens next?</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="flex flex-col items-center text-center">
                            <div className="bg-purple-500/20 rounded-full p-3 mb-3">
                                <Mail className="h-6 w-6 text-purple-400" />
                            </div>
                            <h4 className="text-white font-medium mb-2">Email Confirmation</h4>
                            <p className="text-gray-400 text-sm">Check your inbox for a confirmation email</p>
                        </div>
                        <div className="flex flex-col items-center text-center">
                            <div className="bg-blue-500/20 rounded-full p-3 mb-3">
                                <Users className="h-6 w-6 text-blue-400" />
                            </div>
                            <h4 className="text-white font-medium mb-2">Early Access</h4>
                            <p className="text-gray-400 text-sm">Get priority access when we launch</p>
                        </div>
                        <div className="flex flex-col items-center text-center">
                            <div className="bg-cyan-500/20 rounded-full p-3 mb-3">
                                <Bell className="h-6 w-6 text-cyan-400" />
                            </div>
                            <h4 className="text-white font-medium mb-2">Stay Updated</h4>
                            <p className="text-gray-400 text-sm">Receive exclusive updates and news</p>
                        </div>
                    </div>
                </motion.div>

                {/* Back button */}
                <motion.div
                    className="flex flex-col items-center mb-20"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.6 }}
                >
                    <motion.button
                        onClick={handleGoBack}
                        className="group bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 hover:border-white/30 text-white px-6 py-3 rounded-full flex items-center gap-2 transition-all duration-300"
                        whileHover={{ y: -2, scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                        <span>Back to Home</span>
                    </motion.button>
                </motion.div>
            </div>

            {/* Floating decorative elements */}
            <motion.div
                className="absolute bottom-20 right-20 w-24 h-24 border border-purple-500/20 rounded-full opacity-40"
                animate={{
                    scale: [1, 1.3, 1],
                    rotate: [0, 180, 0],
                    opacity: [0.2, 0.4, 0.2],
                }}
                transition={{
                    repeat: Infinity,
                    duration: 20,
                    ease: "easeInOut",
                }}
            />

            <motion.div
                className="absolute top-32 left-20 w-16 h-16 border border-blue-500/20 rounded-full opacity-40"
                animate={{
                    scale: [1, 1.5, 1],
                    rotate: [0, -180, 0],
                    opacity: [0.2, 0.3, 0.2],
                }}
                transition={{
                    repeat: Infinity,
                    duration: 25,
                    ease: "easeInOut",
                }}
            />

            <motion.div
                className="absolute top-40 right-32 w-12 h-12 border border-cyan-500/20 rounded-full opacity-30"
                animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 360, 0],
                    opacity: [0.2, 0.5, 0.2],
                }}
                transition={{
                    repeat: Infinity,
                    duration: 15,
                    ease: "easeInOut",
                }}
            />

            {/* Status indicator */}
            <motion.div
                className="absolute bottom-6 left-0 right-0 flex justify-center"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.8 }}
            >
                <div className="bg-green-500/20 backdrop-blur-sm border border-green-500/30 rounded-full px-4 py-2">
                    <div className="flex items-center gap-2 text-sm text-green-400">
                        <motion.div
                            className="w-2 h-2 bg-green-400 rounded-full"
                            animate={{
                                opacity: [1, 0.3, 1],
                                scale: [1, 1.2, 1],
                            }}
                            transition={{
                                repeat: Infinity,
                                duration: 2,
                            }}
                        />
                        <span>Waitlist Registration Complete</span>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default ConfirmationPage;