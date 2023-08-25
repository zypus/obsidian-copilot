import { SetChainOptions } from '@/aiState';
import { AI_SENDER, ChatModelDisplayNames, } from '@/constants';
import { ChatMessage } from '@/sharedState';
import { Notice } from 'obsidian';
import React, { useEffect, useState, } from 'react';

import { ChainContextType, ChainType } from '@/chainFactory';
import { RefreshIcon, SaveAsNoteIcon, StopIcon, UseActiveNoteAsContextIcon } from '@/components/Icons';
import { stringToChainType } from '@/utils';
import { getChainContext } from '@/chainContext'

interface ChatIconsProps {
  currentModel: string;
  setCurrentModel: (model: string) => void;
  currentChain: ChainType;
  setCurrentChain: (chain: ChainType, options?: SetChainOptions) => void;
  currentContextType: ChainContextType;
  setCurrentContextType: (context: ChainContextType) => void;
  currentContextSearchKey: string,
  setCurrentContextSearchKey: (key: string) => void;
  onStopGenerating: () => void;
  onNewChat: () => void;
  onSaveAsNote: () => void;
  addMessage: (message: ChatMessage) => void;
}

const ChatIcons: React.FC<ChatIconsProps> = ({
  currentModel,
  setCurrentModel,
  currentChain,
  setCurrentChain,
  currentContextType,
  setCurrentContextType,
  currentContextSearchKey,
  setCurrentContextSearchKey,
  onStopGenerating,
  onNewChat,
  onSaveAsNote,
  addMessage,
}) => {
  const [selectedChain, setSelectedChain] = useState<ChainType>(currentChain);
  const [searchKey, setSearchKey] = useState<string>(currentContextSearchKey);

  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentModel(event.target.value);
  };

  const handleChainChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedChain(stringToChainType(event.target.value));
  }

  const handleContextChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentContextSearchKey('')
    setSearchKey('')
    setCurrentContextType(event.target.value as ChainContextType);
  }

  const handleSearchKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchKey(event.target.value);
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      setCurrentContextSearchKey(searchKey);
    }
  };

  useEffect(() => {
    const handleRetrievalQAChain = async () => {
      if (selectedChain !== ChainType.RETRIEVAL_QA_CHAIN) {
        setCurrentChain(selectedChain);
        return;
      }

      if (!app) {
        console.error('App instance is not available.');
        return;
      }

      if ((currentContextType == ChainContextType.NOTE || currentContextType == ChainContextType.FOLDER || currentContextType == ChainContextType.TAG) && currentContextSearchKey == '') {
        new Notice(`Please provide a ${currentContextType}`);
        return null
      }

      const chainContext = await getChainContext(currentContextType, currentContextSearchKey);
      if (!chainContext) {
        new Notice('No context found');
        console.error('No context found.');
        return;
      }

      const activeNoteOnMessage: ChatMessage = {
        sender: AI_SENDER,
        message: `OK Feel free to ask me questions about ${chainContext.name}.`,
        isVisible: true,
      };
      addMessage(activeNoteOnMessage);
      setCurrentChain(selectedChain, {noteContent: chainContext.content});
    };

    handleRetrievalQAChain();
  }, [selectedChain, currentContextType, currentContextSearchKey]);

  return (
    <div className='chat-icons-container'>
      <div className="chat-icon-selection-tooltip">
        <div className="select-wrapper">
          <select
            id="aiModelSelect"
            className='chat-icon-selection'
            value={currentModel}
            onChange={handleModelChange}
          >
            <option value={ChatModelDisplayNames.GPT_35_TURBO}>{ChatModelDisplayNames.GPT_35_TURBO}</option>
            <option value={ChatModelDisplayNames.GPT_35_TURBO_16K}>{ChatModelDisplayNames.GPT_35_TURBO_16K}</option>
            <option value={ChatModelDisplayNames.GPT_4}>{ChatModelDisplayNames.GPT_4}</option>
            <option value={ChatModelDisplayNames.GPT_4_32K}>{ChatModelDisplayNames.GPT_4_32K}</option>
            {/* <option value={ChatModelDisplayNames.CLAUDE_1}>{ChatModelDisplayNames.CLAUDE_1}</option>
            <option value={ChatModelDisplayNames.CLAUDE_1_100K}>{ChatModelDisplayNames.CLAUDE_1_100K}</option>
            <option value={ChatModelDisplayNames.CLAUDE_INSTANT_1}>{ChatModelDisplayNames.CLAUDE_INSTANT_1}</option>
            <option value={ChatModelDisplayNames.CLAUDE_INSTANT_1_100K}>{ChatModelDisplayNames.CLAUDE_INSTANT_1_100K}</option> */}
            <option value={ChatModelDisplayNames.AZURE_GPT_35_TURBO}>{ChatModelDisplayNames.AZURE_GPT_35_TURBO}</option>
            <option value={ChatModelDisplayNames.AZURE_GPT_35_TURBO_16K}>{ChatModelDisplayNames.AZURE_GPT_35_TURBO_16K}</option>
            <option value={ChatModelDisplayNames.AZURE_GPT_4}>{ChatModelDisplayNames.AZURE_GPT_4}</option>
            <option value={ChatModelDisplayNames.AZURE_GPT_4_32K}>{ChatModelDisplayNames.AZURE_GPT_4_32K}</option>
            <option value={ChatModelDisplayNames.LOCAL_AI}>{ChatModelDisplayNames.LOCAL_AI}</option>
          </select>
          <span className="tooltip-text">Model Selection</span>
        </div>
      </div>
      <button className='chat-icon-button' onClick={onStopGenerating}>
        <StopIcon className='icon-scaler' />
        <span className="tooltip-text">Stop Generating</span>
      </button>
      <button className='chat-icon-button' onClick={onNewChat}>
        <RefreshIcon className='icon-scaler' />
        <span className="tooltip-text">New Chat<br/>(unsaved history will be lost)</span>
      </button>
      <button className='chat-icon-button' onClick={onSaveAsNote}>
        <SaveAsNoteIcon className='icon-scaler' />
        <span className="tooltip-text">Save as Note</span>
      </button>
      <div className="chat-icon-selection-tooltip">
        <div className="select-wrapper">
          <select
            id="aiChainSelect"
            className='chat-icon-selection'
            value={currentChain}
            onChange={handleChainChange}
          >
            <option value='llm_chain'>Conversation</option>
            <option value='retrieval_qa'>QA: Context</option>
          </select>
          <span className="tooltip-text">Mode Selection</span>
        </div>
      </div>
      {currentChain === 'retrieval_qa' && (
        <div className="chat-context-container">
          <div className="chat-icon-selection-tooltip">
            <div className="select-wrapper">
              <select
                id="aiChainContext"
                className="chat-icon-selection"
                value={currentContextType}
                onChange={handleContextChange}
              >
                <option value="active_note">Active Note</option>
                {/*<option value="selection">Selection</option>*/}
                <option value="note">Note</option>
                <option value="folder">Folder</option>
                <option value="tag">Tag</option>
              </select>
              <span className="tooltip-text">Context</span>
            </div>
          </div>
          {(currentContextType === 'note' || currentContextType === 'folder' || currentContextType === 'tag') && (
            <div className="chat-search-key-container">
              <input
                className="chat-search-key"
                type="text"
                placeholder={currentContextType}
                value={searchKey}
                onKeyDown={handleKeyDown}
                onChange={handleSearchKeyChange}
              />
              <button className="chat-icon-button" onClick={() => setCurrentContextSearchKey(searchKey)}>
                <UseActiveNoteAsContextIcon className="icon-scaler" />
                <span className="tooltip-text">Update Context</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatIcons;
