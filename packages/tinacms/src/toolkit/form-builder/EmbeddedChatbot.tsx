
import React from 'react';
import { BiSend } from 'react-icons/bi';

export const EmbeddedChatbot = () => {
    console.log('EmbeddedChatbot rendering');
    return (
        <div className="border-4 border-red-500 bg-red-100 p-4 my-4">
            <div className="mb-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
                    CG-CMS AI Assistant
                </h4>
                <div className="bg-gray-50 rounded p-2 text-sm text-gray-600 mb-2 border border-gray-100 min-h-[60px] max-h-[150px] overflow-y-auto">
                    <p>How can I help you edit your content?</p>
                </div>
            </div>
            <div className="flex gap-2">
                <input
                    type="text"
                    placeholder="Ask AI..."
                    className="flex-1 min-w-0 rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <button
                    className="bg-blue-600 text-white rounded px-3 py-2 hover:bg-blue-700 transition-colors flex items-center justify-center"
                    title="Send"
                >
                    <BiSend className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
