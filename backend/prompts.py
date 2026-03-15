import json
import re
from typing import Optional


def get_topic_roadmap(goal: str) -> str:
    goal_lower = goal.lower()

    if any(kw in goal_lower for kw in ["dsa", "data structures", "algorithm", "leetcode", "coding"]):
        return "Roadmap: Focus on problem-solving patterns (Sliding Window, Two Pointers, BFS/DFS), space/time complexity analysis, and implementing data structures from scratch. Include practice problems."
    elif any(kw in goal_lower for kw in ["machine learning", "ml", "ai", "deep learning", "neural"]):
        return "Roadmap: Structure around Mathematics (Linear Algebra, Calculus, Probability), Core ML Algorithms (Regression, Classification, Clustering), Model Evaluation, and hands-on PyTorch/TensorFlow implementations."
    elif any(kw in goal_lower for kw in ["ssc", "upsc", "exam", "cgl", "gate", "cat", "jee", "neet"]):
        return "Roadmap: Focus on exam syllabus coverage, previous year paper analysis, timed practice sets, and topic-wise revision. Include mock test preparation."
    elif any(kw in goal_lower for kw in ["law", "legal", "attorney", "jurisprudence"]):
        return "Roadmap: Structure around case law reading, constitutional frameworks, legal writing practice, and statutory interpretation analysis."
    elif any(kw in goal_lower for kw in ["react", "frontend", "web", "javascript", "next", "vue", "angular"]):
        return "Roadmap: Structure around Component Architecture, State Management, Routing, API Integration, Performance Optimization, and building functional UI projects."
    elif any(kw in goal_lower for kw in ["python", "java", "c++", "rust", "go", "programming"]):
        return "Roadmap: Cover language fundamentals, OOP concepts, standard library, common patterns, error handling, and build progressively complex projects."
    else:
        return "Roadmap: Apply a structured approach: define core concepts → study theory → guided practice → build projects → test understanding."


def build_generation_prompt(goal: str, days: int, hours_per_day: int, difficulty: str = "Intermediate", include_resources: bool = False, syllabus_text: Optional[str] = None) -> str:
    topic_guidance = get_topic_roadmap(goal)

    syllabus_instruction = ""
    if syllabus_text:
        # Truncate syllabus text to prevent max token issues, allowing ~4000 characters
        truncated_syllabus = syllabus_text[:4000]
        syllabus_instruction = f"""
THE USER UPLOADED A SPECIFIC COURSE SYLLABUS/PLAN. 
You MUST strictly align the generated roadmap topics with the content from this syllabus:
--- SYLLABUS TEXT ---
{truncated_syllabus}
---------------------
"""

    resources_instruction = ""
    resources_prop = ""
    if include_resources:
        resources_instruction = "8. For EACH task, you MUST optionally provide an array of 1-3 highly relevant, high-quality learning resources (documentation links, article links, YouTube searches). Provide real, helpful URLs if possible, or very specific search terms."
        resources_prop = ',\n          "resources": [\n            "https://example.com/useful-article",\n            "https://youtube.com/results?search_query=concept"\n          ]'

    display_goal = goal if goal.strip() else "Master the topics from the attached syllabus or input"
    return f"""You are 'Goal Architect', an elite AI learning schedule creator.

GOAL: "{display_goal}"
TIMELINE: Exactly {days} days
DAILY COMMITMENT: {hours_per_day} hours per day
TARGET DIFFICULTY / EXPERTISE LEVEL: {difficulty}

{topic_guidance}
{syllabus_instruction}

CRITICAL RULES:
1. Generate EXACTLY {days} days of content. Not one more, not one less.
2. Every day MUST contain EXACTLY 3 tasks.
3. Each task MUST include a realistic time estimate that fits within {hours_per_day} hours total per day.
4. Each task MUST have a difficulty level: "easy", "medium", or "hard" (adjusting according to the target difficulty of {difficulty}).
5. Follow this learning progression: Foundations → Core Concepts → Guided Practice → Advanced Topics → Revision & Challenge.
6. Task titles should be specific and actionable (not vague like "Study basics").
7. Ensure the curriculum is tailored for a {difficulty} level learner.
{resources_instruction}

OUTPUT FORMAT:
You MUST output ONLY a valid JSON object. No markdown, no commentary, no explanation. Just raw JSON.

Use this EXACT structure:
{{
  "days": [
    {{
      "day": 1,
      "title": "Descriptive heading summarizing this day's focus (e.g., 'Foundations & Environment Setup', 'Sorting Algorithms Deep Dive')",
      "tasks": [
        {{
          "title": "Specific actionable task description",
          "time": "30 min",
          "difficulty": "easy"{resources_prop}
        }},
        {{
          "title": "Another specific task",
          "time": "1 hour",
          "difficulty": "medium"{resources_prop}
        }},
        {{
          "title": "Third specific task",
          "time": "30 min",
          "difficulty": "hard"{resources_prop}
        }}
      ]
    }}
  ]
}}

Generate the JSON plan now:"""


def build_midplan_addition_prompt(new_goal: str, remaining_days: int, hours_per_day: int, existing_tasks_summary: str, difficulty: str = "Intermediate", include_resources: bool = False, syllabus_text: Optional[str] = None) -> str:
    topic_guidance = get_topic_roadmap(new_goal)

    syllabus_instruction = ""
    if syllabus_text:
        truncated_syllabus = syllabus_text[:4000]
        syllabus_instruction = f"""
THE USER UPLOADED A SPECIFIC COURSE SYLLABUS/PLAN FOR THE NEW GOAL. 
You MUST strictly align the generated NEW topics with the content from this syllabus:
--- SYLLABUS TEXT ---
{truncated_syllabus}
---------------------
"""

    resources_instruction = ""
    resources_prop = ""
    if include_resources:
        resources_instruction = "8. For EACH task, you MUST optionally provide an array of 1-3 highly relevant, high-quality learning resources (documentation links, article links, YouTube searches)."
        resources_prop = ',\n          "resources": [\n            "https://example.com/useful-article"\n          ]'

    display_new_goal = new_goal if new_goal.strip() else "Master the topics from the attached syllabus or input"
    return f"""You are 'Goal Architect', an elite AI learning schedule creator.

The user is CURRENTLY mid-way through a learning plan and wants to ADD a new goal to the remaining days.
You need to merge the existing incomplete topics with the new goal topics over the remaining days.

NEW GOAL TO ADD: "{display_new_goal}"
REMAINING TIMELINE: Exactly {remaining_days} days
DAILY COMMITMENT: {hours_per_day} hours per day
TARGET DIFFICULTY / EXPERTISE LEVEL: {difficulty}

EXISTING INCOMPLETE TASKS (Must continue learning these!):
{existing_tasks_summary}

GUIDANCE FOR NEW GOAL:
{topic_guidance}
{syllabus_instruction}

CRITICAL RULES:
1. Generate EXACTLY {remaining_days} days of content. Not one more, not one less. 
2. The days array should be indexed 1 to {remaining_days}.
3. Every day MUST contain EXACTLY 3 tasks.
4. The 3 tasks per day MUST be a MIX of continuing the EXISTING tasks and starting the NEW goal. Do not drop the old tasks!
5. Each task MUST include a realistic time estimate that fits within {hours_per_day} hours total per day.
6. Each task MUST have a difficulty level: "easy", "medium", or "hard" (tailoring for a {difficulty} learner).
7. Task titles should be specific and actionable.
{resources_instruction}

OUTPUT FORMAT:
You MUST output ONLY a valid JSON object. No markdown, no commentary. Just raw JSON.

Use this EXACT structure:
{{
  "days": [
    {{
      "day": 1,
      "title": "Descriptive heading summarizing this day's focus",
      "tasks": [
        {{
          "title": "Specific actionable task description",
          "time": "30 min",
          "difficulty": "medium"{resources_prop}
        }}
      ]
    }}
  ]
}}

Generate the JSON merged plan now:"""


def parse_llm_response(response_text: str) -> dict:
    """
    Parses the JSON output from the LLM.
    Returns a dict with 'goal_title' and 'days'.
    Robust against markdown formatting, conversational wrapping, and malformed output.
    """
    text = response_text.strip()

    # Strip markdown code fences
    if text.startswith("```json"):
        text = text[7:]
    elif text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    # Extract JSON block using regex
    json_match = re.search(r'\{[\s\S]*\}', text)
    if json_match:
        text = json_match.group(0)
    else:
        text = text.replace("```json", "").replace("```", "").strip()

    try:
        data = json.loads(text)
        plan = []
        days_array = data.get("days", [])
        goal_title = data.get("goal_title", "Custom Learning Plan")

        for day_obj in days_array:
            raw_tasks = day_obj.get("tasks", [])
            parsed_tasks = []

            for t in raw_tasks[:3]:  # Enforce max 3
                if isinstance(t, str):
                    # Old format fallback: plain string tasks
                    parsed_tasks.append({
                        "title": t,
                        "time": "30 min",
                        "difficulty": "medium",
                        "resources": []
                    })
                elif isinstance(t, dict):
                    parsed_tasks.append({
                        "title": str(t.get("title", t.get("description", "Unknown Task"))),
                        "time": str(t.get("time", "30 min")),
                        "difficulty": str(t.get("difficulty", "medium")),
                        "resources": list(t.get("resources") or [])
                    })

            plan.append({
                "day": day_obj.get("day", 1),
                "concept": day_obj.get("title", "Unknown Topic"),
                "tasks": parsed_tasks
            })

        return {
            "goal_title": goal_title,
            "days": plan
        }
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON from LLM: {e}")
        print(f"Raw text was: {text[:500]}")
        return {
            "goal_title": "Custom Learning Plan",
            "days": []
        }

def build_analysis_prompt(goal_title: str, completed_tasks: list, incomplete_tasks: list) -> str:
    prompt = f"""
I have completed a learning module for the goal: "{goal_title}".
Here are the tasks I successfully completed:
{chr(10).join([f'- {t}' for t in completed_tasks]) if completed_tasks else "- None"}

Here are the tasks I failed to complete or skipped:
{chr(10).join([f'- {t}' for t in incomplete_tasks]) if incomplete_tasks else "- None"}

Please provide a brief, detailed performance analysis. Highlight my strong areas based on what I completed, and identify my shortcomings or knowledge gaps based on what I missed. Offer constructive advice on how I can bridge those gaps or improve my learning approach next.

Return the response as raw markdown text (no JSON formatting needed). Keep it encouraging but analytical.
"""
    return prompt.strip()


def build_quote_prompt() -> str:
    return """
You are an inspiring mentor and a master of motivation.
Provide a single, powerful, short motivational quote (max 20 words).
The quote MUST be about one of these themes:
- Never giving up
- Consistency and daily effort
- Challenging the mind to overcome the urge to quit
- Discipline over motivation

DO NOT INCLUDE quotes marks. Just return the raw text of the quote itself.
Make it sound original, hard-hitting, and highly motivational for someone studying or working on difficult goals.
"""
