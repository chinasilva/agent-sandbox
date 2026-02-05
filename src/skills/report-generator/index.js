/**
 * Report Generator Skill
 * Generates comprehensive reports based on task requirements
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Execute report generation
 */
export default async function reportGeneratorSkill({ task, context }) {
  const result = {
    task,
    timestamp: new Date().toISOString(),
    sections: [],
    metadata: {},
    summary: '',
  };

  try {
    // Analyze report type
    const reportType = analyzeReportType(task);
    
    // Generate report sections
    switch (reportType.type) {
      case 'travel':
        result.sections = generateTravelReport(task, context);
        break;
      case 'technical':
        result.sections = generateTechnicalReport(task, context);
        break;
      case 'research':
        result.sections = generateResearchReport(task, context);
        break;
      case 'summary':
        result.sections = generateSummaryReport(task, context);
        break;
      default:
        result.sections = generateGenericReport(task, context);
    }

    result.metadata = {
      type: reportType.type,
      sections: result.sections.length,
      generatedAt: new Date().toISOString(),
    };

    result.summary = `Generated ${reportType.type} report with ${result.sections.length} sections`;

  } catch (error) {
    result.error = error.message;
    result.summary = `Report generation failed: ${error.message}`;
  }

  return result;
}

/**
 * Analyze report type from task
 */
function analyzeReportType(task) {
  const types = {
    travel: /\b(travel|trip|vacation|itinerary|plan)\b/i,
    technical: /\b(technical|code|development|api|system)\b/i,
    research: /\b(research|analysis|study|survey)\b/i,
    summary: /\b(summary|overview|brief|wrap.?up)\b/i,
  };

  for (const [type, pattern] of Object.entries(types)) {
    if (pattern.test(task)) {
      return { type, confidence: 'high' };
    }
  }

  return { type: 'generic', confidence: 'low' };
}

/**
 * Generate travel report
 */
function generateTravelReport(task, context) {
  const sections = [];
  const id = uuidv4().substring(0, 8);

  // Extract travel details
  const destinationMatch = task.match(/\b(to|in|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/);
  const durationMatch = task.match(/(\d+)\s*(day|week|month)/i);
  const budgetMatch = task.match(/\$[\d,]+|(\d+)\s*(dollar|USD|预算)/i);

  const destination = destinationMatch ? destinationMatch[2] : 'Your Destination';
  const duration = durationMatch ? durationMatch[0] : '7 days';
  const budget = budgetMatch ? budgetMatch[0] : '$2000';

  // Overview section
  sections.push({
    title: 'Trip Overview',
    content: `# 🌍 ${destination} Trip Plan\n\n## Overview\n\n- **Destination**: ${destination}\n- **Duration**: ${duration}\n- **Budget**: ${budget}\n- **Generated**: ${new Date().toLocaleDateString()}\n\n## Quick Summary\n\nThis comprehensive travel plan covers accommodations, activities, dining recommendations, and practical tips for your trip to ${destination}.`,
  });

  // Itinerary section
  sections.push({
    title: 'Day-by-Day Itinerary',
    content: `## 📅 Day-by-Day Itinerary\n\n### Day 1: Arrival\n- Arrive at destination\n- Check-in at hotel\n- Light exploration of the area\n- Welcome dinner\n\n### Day 2-3: Main Attractions\n- Visit top tourist spots\n- Local culture experience\n- Photography tour\n\n### Day 4-5: Activities\n- Adventure activities\n- Hidden gems exploration\n- Local markets visit\n\n### Day 6-7: Relaxation & Departure\n- Leisure time\n- Souvenir shopping\n- Departure preparations`,
  });

  // Accommodations section
  sections.push({
    title: 'Accommodations',
    content: `## 🏨 Recommended Accommodations\n\n### Budget Option\n- **Hotel**: City Center Hostel\n- **Price**: $30-50/night\n- **Rating**: 4.0+ stars\n\n### Mid-Range Option\n- **Hotel**: Grand Plaza Hotel\n- **Price**: $100-150/night\n- **Rating**: 4.5 stars\n\n### Luxury Option\n- **Resort**: Paradise Resort & Spa\n- **Price**: $300+/night\n- **Rating**: 5 stars`,
  });

  // Activities section
  sections.push({
    title: 'Top Activities',
    content: `## 🎯 Top Activities\n\n### Must-Do\n1. ✅ Visit famous landmarks\n2. ✅ Try local cuisine\n3. ✅ Explore historical sites\n\n### Optional\n- 🎭 Theater show\n- 🛥️ Sunset cruise\n- 🏔️ Hiking trail\n\n### Local Experiences\n- 🍜 Food tour\n- 🎨 Art gallery visit\n- 🎵 Live music venue`,
  });

  // Budget section
  sections.push({
    title: 'Budget Breakdown',
    content: `## 💰 Budget Breakdown\n\n| Category | Estimated Cost |\n|----------|----------------|\n| Accommodation | $${Math.floor(parseInt(budget.replace(/[^0-9]/g, '')) * 0.4) || 800} |\n| Food & Dining | $${Math.floor(parseInt(budget.replace(/[^0-9]/g, '')) * 0.25) || 500} |\n| Activities | $${Math.floor(parseInt(budget.replace(/[^0-9]/g, '')) * 0.2) || 400} |\n| Transportation | $${Math.floor(parseInt(budget.replace(/[^0-9]/g, '')) * 0.1) || 200} |\n| Misc | $${Math.floor(parseInt(budget.replace(/[^0-9]/g, '')) * 0.05) || 100} |\n| **Total** | **${budget}** |`,
  });

  // Tips section
  sections.push({
    title: 'Travel Tips',
    content: `## 💡 Essential Tips\n\n### Before You Go\n- ✅ Book accommodations in advance\n- ✅ Check visa requirements\n- ✅ Get travel insurance\n- ✅ Download offline maps\n\n### Local Customs\n- Learn basic local phrases\n- Tipping practices\n- Dress code for attractions\n\n### Safety\n- Keep copies of documents\n- Emergency contacts\n- Safe neighborhood areas`,
  });

  return sections;
}

/**
 * Generate technical report
 */
function generateTechnicalReport(task, context) {
  return [
    {
      title: 'Technical Overview',
      content: `## Technical Report\n\n### Project: ${task.substring(0, 50)}...\n\n#### Executive Summary\nThis technical document outlines the requirements, architecture, and implementation details.\n\n#### Scope\n- Analysis of current state\n- Proposed solution\n- Implementation strategy`,
    },
    {
      title: 'Requirements',
      content: `## Requirements\n\n### Functional Requirements\n1. System shall perform X\n2. User shall be able to Y\n3. Application shall handle Z\n\n### Non-Functional Requirements\n- Performance: < 200ms response time\n- Scalability: Support 1000 concurrent users\n- Security: OAuth 2.0 authentication`,
    },
    {
      title: 'Architecture',
      content: `## Architecture\n\n### High-Level Design\n\`\`\n[Architecture Diagram Placeholder]\n\`\`\`\n\n### Technology Stack\n- Frontend: React, TypeScript\n- Backend: Node.js, Express\n- Database: PostgreSQL\n- Cloud: AWS/Vercel`,
    },
    {
      title: 'Implementation',
      content: `## Implementation\n\n### Phase 1: Core Features\n- Setup development environment\n- Implement user authentication\n- Build main functionality\n\n### Phase 2: Enhancements\n- Performance optimization\n- Additional features\n- User feedback integration`,
    },
    {
      title: 'Testing',
      content: `## Testing Strategy\n\n### Unit Testing\n- Jest for unit tests\n- Coverage: > 80%\n\n### Integration Testing\n- API endpoint testing\n- Database integration\n\n### E2E Testing\n- Cypress for E2E\n- Critical user journeys`,
    },
  ];
}

/**
 * Generate research report
 */
function generateResearchReport(task, context) {
  return [
    {
      title: 'Research Overview',
      content: `## Research Report: ${task.substring(0, 50)}...\n\n### Abstract\nThis report presents findings on the topic of "${task}".\n\n### Methodology\n- Data collection methods\n- Analysis approach\n- Key findings`,
    },
    {
      title: 'Background',
      content: `## Background Information\n\n### Context\nHistorical and current context of the topic.\n\n### Literature Review\nSummary of existing research and publications.`,
    },
    {
      title: 'Findings',
      content: `## Key Findings\n\n### Primary Discoveries\n1. Finding A: Description and implications\n2. Finding B: Description and implications\n3. Finding C: Description and implications\n\n### Data Analysis\nStatistical analysis and interpretation of results.`,
    },
    {
      title: 'Conclusions',
      content: `## Conclusions\n\n### Summary\nKey takeaways from this research.\n\n### Recommendations\nActionable recommendations based on findings.\n\n### Future Work\nAreas for further investigation.`,
    },
    {
      title: 'References',
      content: `## References\n\n1. [Source 1] Title, Author, Year\n2. [Source 2] Title, Author, Year\n3. [Source 3] Title, Author, Year`,
    },
  ];
}

/**
 * Generate summary report
 */
function generateSummaryReport(task, context) {
  return [
    {
      title: 'Executive Summary',
      content: `## Summary: ${task.substring(0, 50)}...\n\n### Overview\nBrief summary of the main points.\n\n### Key Takeaways\n1. Point A\n2. Point B\n3. Point C`,
    },
    {
      title: 'Details',
      content: `## Detailed Breakdown\n\n### Section 1\nSupporting information and context.\n\n### Section 2\nAdditional details and analysis.\n\n### Section 3\nFinal observations and recommendations.`,
    },
  ];
}

/**
 * Generate generic report
 */
function generateGenericReport(task, context) {
  return [
    {
      title: 'Report',
      content: `## ${task.substring(0, 50)}...\n\n### Overview\nThis report addresses the requested topic.\n\n### Content\n${task}\n\n### Conclusion\nBased on the analysis, the following conclusions can be drawn.`,
    },
  ];
}
