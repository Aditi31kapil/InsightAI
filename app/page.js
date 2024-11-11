'use client'
import React, { useState, useEffect } from 'react';
import { Button, Card, CardHeader, CardContent, Box, IconButton } from "@mui/material"
import { X } from 'lucide-react'
import styles from './page.module.css'
import './global.css'
import Cerebras from '@cerebras/cerebras_cloud_sdk'
import CloseIcon from '@mui/icons-material/Close';

export default function ResearchPaperDisplay() {
  const [loading, setLoading] = useState(false);
  const [processedPapers, setProcessedPapers] = useState([]);
  const [currentlyProcessing, setCurrentlyProcessing] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [isStorytelling, setIsStorytelling] = useState(false);
  const [storyExplanation, setStoryExplanation] = useState('');
  const [funFacts, setFunFacts] = useState([]);
  const [relatedTopics, setRelatedTopics] = useState([]);
  const cerebras = () => {
    const apiKey = process.env.CEREBRAS_API_KEY; // Correctly retrieve the API key
    return new Cerebras({ apiKey }); // Pass the apiKey in the object
  };
  // Function to fetch fun facts while processing
  const getFunFacts = async (query) => {
    try {
      const prompt = `Generate exactly 3 interesting and fun facts related to "${query}". 
      Start each fact with a bullet point (•) and make them brief and engaging.
      Keep each fact to a single line.`;
      
      const response = await cerebras.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama3.1-8b',
      });
  
      const content = response.choices[0].message.content;
      
      // Split the content by bullet points and clean up
      const facts = content
        .split('•')
        .map(fact => fact.trim())
        .filter(fact => fact.length > 0)
        .slice(0, 3); // Ensure we only get 3 facts
  
      setFunFacts(facts);
    } catch (error) {
      console.error('Error fetching fun facts:', error);
      setFunFacts(['Did you know? Fun facts are loading...']);
    }
  };
  // Function to process a single paper
  const processPaper = (paper) => {
    const { title, authors, summary, topics, url, year, other } = paper;
    return {
      title: title ? title.trim() : 'No Title Available',
      authors: authors && Array.isArray(authors) ? authors.map(author => author.trim()) : ['Unknown Author'],
      summary: summary ? summary.trim() : 'No Summary Available',
      topics: topics && Array.isArray(topics) ? topics.join(', ') : 'No Topics Available',
      url: url ? url.trim() : 'No URL Available',
      year: year ? year.trim() : 'No Year Available',
      other: other ? other.trim() : 'No Additional Information Available'
    };
  };
  /* Clean up response text to ensure valid JSON*/
  const cleanJsonResponse = (text) => {
    // Remove any markdown code block indicators
    text = text.replace(/```json\s?/g, '');
    text = text.replace(/```\s?/g, '');
    
    // Remove any leading/trailing whitespace
    text = text.trim();
    
    // Find the first '{' and last '}' to extract just the JSON object
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}') + 1;
    
    if (startIndex === -1 || endIndex === 0) {
      throw new Error('No valid JSON object found in response');
    }
    
    return text.slice(startIndex, endIndex);
  };

  const generateStoryExplanation = async (paper) => {
    setSelectedPaper(paper);
    setIsStorytelling(true);
    setStoryExplanation(null); // Reset story while loading
  
    try {
      // First prompt for the engaging story
      const storyPrompt = `Create a captivating a short paragraph story that explains the research paper "${paper.title}" in an engaging way(use emojis). 
      Make it conversational and easy to understand for a general audience, while maintaining scientific accuracy.
      Base the story on this summary: "${paper.summary}"`;
  
      const storyResponse = await cerebras.chat.completions.create({
        messages: [{ role: 'user', content: storyPrompt }],
        model: 'llama3.1-8b',
      });
  
      // Then prompt for the structured breakdown
      const breakdownPrompt = `Based on the research paper "${paper.title}" and its summary "${paper.summary}",
      provide a structured analysis in JSON format:
      {
        "challenge": "2-3 sentences on the core problem",
        "approach": "2-3 sentences on the research methodology",
        "findings": "2-3 sentences on key discoveries",
        "significance": "2-3 sentences on real-world impact"
      }`;
  
      const breakdownResponse = await cerebras.chat.completions.create({
        messages: [{ role: 'user', content: breakdownPrompt }],
        model: 'llama3.1-8b',
      });
  
      try {
        // Clean and parse the breakdown response
        const cleanedJson = cleanJsonResponse(breakdownResponse.choices[0].message.content);
        const parsedBreakdown = JSON.parse(cleanedJson);
        
        // Combine story and breakdown into one structure
        setStoryExplanation({
          mainStory: storyResponse.choices[0].message.content,
          breakdown: {
            challenge: parsedBreakdown.challenge || 'Analysis not available',
            approach: parsedBreakdown.approach || 'Analysis not available',
            findings: parsedBreakdown.findings || 'Analysis not available',
            significance: parsedBreakdown.significance || 'Analysis not available'
          }
        });
      } catch (parseError) {
        console.error('Error parsing breakdown:', parseError);
        // Fallback with just the story if breakdown parsing fails
        setStoryExplanation({
          mainStory: storyResponse.choices[0].message.content,
          breakdown: {
            challenge: 'Detailed analysis temporarily unavailable',
            approach: 'Please try again later',
            findings: 'Error processing structured breakdown',
            significance: 'You can still enjoy the story above!'
          }
        });
      }
    } catch (error) {
      console.error('Error generating story:', error);
      setStoryExplanation({
        mainStory: 'Error generating story explanation. Please try again later.',
        breakdown: {
          challenge: 'Error occurred',
          approach: 'Unable to generate analysis',
          findings: 'Please try again',
          significance: 'If this persists, contact support'
        }
      });
    }
  };
  
  // Updated StorySection components to handle the new format
  const StorySection = ({ title, content }) => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-blue-800 mb-2">{title}</h3>
      <p className="text-gray-700 leading-relaxed">{content}</p>
    </div>
  );
  

  const handleClose = () => {
    setIsStorytelling(false);
  };
  const searchPapers = async () => {
    setLoading(true);
    setProcessedPapers([]);
    await getFunFacts(searchQuery);
  
    try {
      const prompt = `Search for research papers about "${searchQuery}". For each paper, Write the given information in json format as shown below:
      {
        "title": "paper title",
        "authors": ["author names"],
        "summary": "brief 2-3 sentence summary",
        "topics": ["related topics"],
        "url": "paper URL",
        "year": "publication year",
        "other": "additional info"
      }
      After listing 5 papers, provide a list of additional related topics under "additionalTopics": ["topic1", "topic2", ...]`;
  
      const response = await cerebras.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama3.1-8b',
      });
  
      const text = response.choices[0].message.content;
      if (!text) {
        throw new Error('No response received from the model');
      }
  
      // Extract individual paper JSON objects and additional topics
      const paperMatches = text.match(/\{[\s\S]*?\}/g) || [];
      const additionalTopicsMatch = text.match(/\"additionalTopics\":\s*\[([\s\S]*?)\]/);
      
      // Parse papers
      const papers = paperMatches.map(paperJson => {
        try {
          return JSON.parse(paperJson);
        } catch (e) {
          console.error('Error parsing paper JSON:', e);
          return null;
        }
      }).filter(paper => paper !== null);
  
      // Parse additional topics
      let additionalTopics = [];
      if (additionalTopicsMatch && additionalTopicsMatch[1]) {
        try {
          additionalTopics = JSON.parse(`[${additionalTopicsMatch[1]}]`);
        } catch (e) {
          // Extract topics using regex as fallback
          additionalTopics = additionalTopicsMatch[1]
            .split(',')
            .map(topic => topic.trim().replace(/['"]/g, ''))
            .filter(topic => topic.length > 0);
        }
      }
  
      // Process papers sequentially
      for (let i = 0; i < papers.length; i++) {
        setCurrentlyProcessing(i + 1);
        const processedPaper = processPaper(papers[i]);
        await new Promise(resolve => setTimeout(resolve, 500));
        setProcessedPapers(prev => [...prev, processedPaper]);
      }
  
      // Set additional topics
      setRelatedTopics(additionalTopics);
  
    } catch (error) {
      console.error('Error searching papers:', error);
    } finally {
      setLoading(false);
      setCurrentlyProcessing(null);
    }
  };
  // JavaScript code to make the popup draggable


  return (
    <div className={styles.body}>
    <div className={styles['main-container']}>
      {/* Heading Section */}
      <header className={styles.header}>
        <h1>Insight AI</h1>
        <p>Explore insights from academic papers with ease</p>
      </header>
      
      <div className={styles['flex-container']}>
        {/* Main Content */}
        <div className={`${styles['main-content']} ${isStorytelling ? styles['storytelling-active'] : ''}`}>
          
          {/* Search Section */}
          <div className={styles['search-section']}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles['search-input']}
              placeholder="Enter search query..."
            />
            <button className={styles['search-button']} onClick={searchPapers} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          
          {/* Processing Status and Fun Facts */}
          {(loading || currentlyProcessing) && (
            <div className={styles['fun-facts']}>
              {currentlyProcessing && (
                <p>Processing paper {currentlyProcessing}...</p>
              )}
              {funFacts.length > 0 && (
                <div>
                  <h3>Fun Facts While You Wait:</h3>
                  <ul>
                    {funFacts.map((fact, index) => (
                      <li key={index}>{fact}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          {/* Papers Grid */}
          <div className={styles['grid-container']}>
            {processedPapers.map((paper, index) => (
              <div key={index} className={styles.card}>
                <h2>{paper.title}</h2>
                <p>Published: {paper.year} | Authors: {paper.authors.join(', ')}</p>
                <p>{paper.summary}</p>
                <div>
                  <button className={styles['card-button']} onClick={() => generateStoryExplanation(paper)}>
                    Explain with Story
                  </button>
                  {paper.url !== 'No URL Available' && (
                    <button className={styles['card-button']} onClick={() => window.open(paper.url, '_blank')}>
                      View Paper
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Related Topics */}
          {relatedTopics.length > 0 && (
            <div className={styles['grid-container']}>
              <h2>Additional Related Topics</h2>
              {relatedTopics.map((topic, index) => (
                <span key={index} className={styles['related-topic']}>{topic}</span>
              ))}
            </div>
          )}
          
          {/* Story Explanation Sidebar */}
          {isStorytelling && (
            <div className={styles['story-popup']}>
              {!storyExplanation ? (
                <div className={styles['loading']}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={styles['loading-pulse']}>
                      <div className={styles['pulse-header']}></div>
                      <div className={styles['pulse-content']}></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles['story-content-wrapper']}>
                  <h3>The Story</h3>
                  <IconButton
                    onClick={handleClose}
                    className={styles['close-button']}
                    aria-label="Close"
                  >
                  <CloseIcon />
                  </IconButton>
                  <div className={styles['story-content']}>
                    <p>{storyExplanation.mainStory}</p>
                  </div>
                  <div className={styles['divider']}></div>
                  <div>
                    <h3>Detailed Breakdown</h3>
                    <StorySection title="The Challenge" content={storyExplanation.breakdown.challenge} />
                    <StorySection title="The Approach" content={storyExplanation.breakdown.approach} />
                    <StorySection title="Key Findings" content={storyExplanation.breakdown.findings} />
                    <StorySection title="Real-World Impact" content={storyExplanation.breakdown.significance} />
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
    </div>
  );
}
