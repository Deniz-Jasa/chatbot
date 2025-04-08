import { motion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { MessageIcon, VercelIcon } from './icons';

export const Overview = () => {
  const [showHelpText, setShowHelpText] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowHelpText(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20 flex items-center justify-center"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: 0 }}
    >
      <div className="rounded-xl p-6 flex flex-col gap-8 leading-relaxed text-center max-w-xl">
        <div className="flex flex-col items-center justify-center">
          <div className="flex flex-col items-center justify-center relative">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="text-lg font-bold"
            >
              Hello there!
            </motion.div>
            {showHelpText && (
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="text-lg text-[#757575]"
              >
                How can I help you today?
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
