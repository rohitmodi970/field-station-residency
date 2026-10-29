import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, X, Mail, Loader2, ArrowRight, Zap, Lock, Shield } from "lucide-react"

interface WaitlistAccessCheckerProps {
  className?: string
}

const WaitlistAccessChecker: React.FC<WaitlistAccessCheckerProps> = ({ className = "" }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'denied' | 'error'>('idle')
  const [message, setMessage] = useState("")
  const [showSuccess, setShowSuccess] = useState(false)

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModal()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isModalOpen])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isModalOpen])

  const openModal = () => {
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    resetForm()
  }

  const resetForm = () => {
    setEmail("")
    setStatus('idle')
    setMessage("")
    setShowSuccess(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsLoading(true)
    setStatus('idle')

    try {
      const response = await fetch('/api/betaUsers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await response.json()

      if (response.ok && data.hasAccess) {
        setStatus('success')
        setMessage(data.message || "Welcome! You have beta access.")
        setShowSuccess(true)
      } else {
        setStatus('denied')
        setMessage(data.message || "You're not on the beta access list yet. Keep an eye on your inbox!")
      }
    } catch (error) {
      setStatus('error')
      setMessage("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignInRedirect = () => {
    window.location.href = '/login'
  }

  const triggerButtonVariants = {
    hover: { 
      scale: 1.05, 
      y: -2,
      boxShadow: "0 20px 40px rgba(147, 51, 234, 0.3)",
      transition: { duration: 0.2 }
    },
    tap: { scale: 0.95 }
  }

  const modalVariants = {
    hidden: { 
      opacity: 0,
      scale: 0.8,
      y: 50
    },
    visible: { 
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { 
        type: "spring" as const, 
        stiffness: 300, 
        damping: 30,
        duration: 0.4
      }
    },
    exit: { 
      opacity: 0,
      scale: 0.8,
      y: 50,
      transition: { duration: 0.3 }
    }
  }

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.3 } }
  }

  const inputVariants = {
    focus: {
      scale: 1.02,
      boxShadow: "0 0 0 3px rgba(147, 51, 234, 0.1)",
      transition: { duration: 0.2 }
    },
    blur: {
      scale: 1,
      boxShadow: "0 0 0 0px rgba(147, 51, 234, 0)",
      transition: { duration: 0.2 }
    }
  }

  const statusVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { 
        type: "spring" as const, 
        stiffness: 400, 
        damping: 25,
        duration: 0.5
      }
    },
    exit: { 
      opacity: 0, 
      y: -20, 
      scale: 0.95,
      transition: { duration: 0.3 }
    }
  }

  const particleVariants = {
    hidden: { opacity: 0, scale: 0 },
    visible: {
      opacity: [0, 1, 0],
      scale: [0, 1, 0],
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "loop" as const,
        ease: "easeInOut" as const
      }
    }
  }

  return (
    <>
      {/* Trigger Button */}
      <motion.button
        onClick={openModal}
        className={`relative inline-flex items-center justify-center gap-3 px-8 py-4 text-white bg-gradient-to-r from-purple-500 to-pink-500 dark:from-purple-400 dark:to-pink-400 rounded-2xl font-medium overflow-hidden group ${className}`}
        variants={triggerButtonVariants}
        whileHover="hover"
        whileTap="tap"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
        <Shield className="w-5 h-5" />
        Check Beta Access
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              variants={overlayVariants}
              onClick={closeModal}
            />

            {/* Modal Content */}
            <motion.div
              className="relative w-full max-w-md"
              variants={modalVariants}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Background particles for success state */}
              <AnimatePresence>
                {showSuccess && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                    {[...Array(15)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `${Math.random() * 100}%`,
                        }}
                        variants={particleVariants}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                      />
                    ))}
                  </div>
                )}
              </AnimatePresence>

              <div className="backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-pink-500/5 to-purple-500/5" />
                
                {/* Close Button */}
                <motion.button
                  onClick={closeModal}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-200"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>

                <div className="relative z-10">
                  <div className="text-center mb-8">
                    <motion.div
                      className="inline-flex items-center gap-2 mb-4"
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Lock className="w-6 h-6 text-purple-500" />
                      <h2 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
                        Check Beta Access
                      </h2>
                    </motion.div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      Already on the waitlist? Check if you've received beta access
                    </p>
                  </div>

                  <AnimatePresence mode="wait">
                    {!showSuccess ? (
                      <motion.form
                        key="form"
                        onSubmit={handleSubmit}
                        className="space-y-6"
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3 }}
                      >
                        <motion.div
                          className="relative"
                          variants={inputVariants}
                          whileFocus="focus"
                          initial="blur"
                        >
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="Enter your email address"
                              className="w-full pl-12 pr-4 py-4 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl text-gray-800 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:border-purple-400 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/50 transition-all duration-300"
                              required
                              disabled={isLoading}
                              autoFocus
                            />
                          </div>
                        </motion.div>

                        <motion.button
                          type="submit"
                          disabled={isLoading || !email.trim()}
                          className="w-full relative inline-flex items-center justify-center gap-2 px-8 py-4 text-white bg-gradient-to-r from-purple-500 to-pink-500 dark:from-purple-400 dark:to-pink-400 rounded-2xl hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 font-medium overflow-hidden"
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 hover:opacity-20 transition-opacity duration-300" />
                          
                          {isLoading ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Checking Access...
                            </>
                          ) : (
                            <>
                              <Zap className="w-5 h-5" />
                              Check My Access
                            </>
                          )}
                        </motion.button>

                        <AnimatePresence>
                          {status !== 'idle' && (
                            <motion.div
                              variants={statusVariants}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
                              className={`p-4 rounded-2xl border backdrop-blur-sm ${
                                status === 'success'
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
                                  : status === 'denied'
                                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {status === 'success' && <Check className="w-5 h-5 flex-shrink-0" />}
                                {status === 'denied' && <Mail className="w-5 h-5 flex-shrink-0" />}
                                {status === 'error' && <X className="w-5 h-5 flex-shrink-0" />}
                                <p className="text-sm font-medium">{message}</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.form>
                    ) : (
                      <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className="text-center space-y-6"
                      >
                        <motion.div
                          className="w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: "spring", stiffness: 400, damping: 25 }}
                        >
                          <Check className="w-10 h-10 text-white" />
                        </motion.div>

                        <div className="space-y-4">
                          <h3 className="text-2xl font-semibold text-gray-800 dark:text-gray-200">
                            🎉 Welcome to Force Beta!
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            You're all set! Ready to start your journey with Force? Sign in to begin transforming your thoughts into meaningful change.
                          </p>
                        </div>

                        <div className="flex flex-col gap-3">
                          <motion.button
                            onClick={handleSignInRedirect}
                            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-white bg-gradient-to-r from-purple-500 to-pink-500 dark:from-purple-400 dark:to-pink-400 rounded-2xl hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5 font-medium"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            Sign In to Force
                            <ArrowRight className="w-5 h-5" />
                          </motion.button>
                          
                          <motion.button
                            onClick={resetForm}
                            className="inline-flex items-center justify-center gap-2 px-8 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl transition-all duration-300 font-medium"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            Check Another Email
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default WaitlistAccessChecker