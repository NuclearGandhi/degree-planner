import json
import re
from pathlib import Path
import os

import requests

def get_last_semesters():
    last_semesters_url = "https://michael-maltsev.github.io/technion-sap-info-fetcher/last_semesters.json"
    last_semesters_sap = requests.get(last_semesters_url).json()

    last_semesters = {}
    for last_semester in last_semesters_sap:
        semester = str(last_semester["year"]) + str(
            last_semester["semester"] - 200 + 1
        ).zfill(2)
        last_semesters[semester] = {
            "start": last_semester["start"],
            "end": last_semester["end"],
        }

    return last_semesters

def get_latest_two_semesters(last_semesters):
    # Sort by year and semester code (02=spring, 01=winter)
    sorted_semesters = sorted(
        [((int(key[:4]), int(key[4:])), key) for key in last_semesters.keys()],
        reverse=True
    )
    latest_spring = next((original_key for (year, semester), original_key in sorted_semesters if semester == 2), None)
    latest_winter = next((original_key for (year, semester), original_key in sorted_semesters if semester == 1), None)
    return latest_winter, latest_spring

def map_semester_code(semester):
    year = semester[:4]
    sem = semester[4:]
    # Map '01' to '200' (winter), '02' to '201' (spring)
    if sem == '01':
        mapped_sem = '200'
    elif sem == '02':
        mapped_sem = '201'
    else:
        raise ValueError(f"Unknown semester code: {sem}")
    return year, mapped_sem

def fetch_and_save_courses(semester, filename):
    year, mapped_sem = map_semester_code(semester)
    courses_url = f"https://raw.githubusercontent.com/michael-maltsev/technion-sap-info-fetcher/gh-pages/courses_{year}_{mapped_sem}.json"
    response = requests.get(courses_url)
    if response.status_code == 200:
        # Ensure the directory exists
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(response.json(), f, ensure_ascii=False, indent=4)
        return response.json()
    else:
        raise RuntimeError(f"Failed to fetch courses for semester {semester}: {response.status_code}")

# Python version of parsePrerequisiteTree from courseGraph.js
def parse_prerequisite_tree(prereq_str):
    if not prereq_str:
        return None

    s = prereq_str
    s = re.sub(r'([()])', r' \1 ', s)
    s = re.sub(r'או', ' או ', s)
    # Separate 'ו-' as a conjunction, but not inside 'או'
    s = re.sub(r'(?<!א)ו-', ' ו- ', s)
    # Separate standalone 'ו' as a conjunction, but not inside 'או'
    s = re.sub(r'(?<!א)ו(?![\w-])', ' ו ', s)
    s = re.sub(r',', ' , ', s)
    tokens = [t for t in s.split() if t]

    def parse_tokens(tokens):
        def parse_expr(idx):
            items = []  # Each item is (op, term)
            op = None
            while idx < len(tokens):
                token = tokens[idx]
                if token == '(':  # Start subexpression
                    sub, idx = parse_expr(idx + 1)
                    items.append((op, sub))
                    op = None
                elif token == ')':  # End subexpression
                    idx += 1
                    break
                elif token == 'או':
                    op = 'or'
                    idx += 1
                elif token == 'ו' or token == ',' or token == 'ו-':
                    op = 'and'
                    idx += 1
                elif re.match(r'^\d{8}$', token):
                    items.append((op, token))
                    op = None
                    idx += 1
                else:
                    idx += 1  # Skip unknown tokens

            # Now group items by top-level operator
            # Remove leading None ops (first term)
            ops = [o for o, _ in items if o is not None]
            if not items:
                return None, idx
            if not ops:
                # Only one term
                return items[0][1], idx
            # If all ops are the same (and not None), use that
            if all(o == 'or' for o in ops):
                return {'or': [t for _, t in items]}, idx
            if all(o == 'and' for o in ops):
                return {'and': [t for _, t in items]}, idx
            # Mixed: group by 'or' at the top, 'and' inside
            grouped = []
            current = []
            for i, (o, t) in enumerate(items):
                if i == 0 or o == 'and' or o is None:
                    current.append(t)
                elif o == 'or':
                    if len(current) == 1:
                        grouped.append(current[0])
                    else:
                        grouped.append({'and': current})
                    current = [t]
            if len(current) == 1:
                grouped.append(current[0])
            else:
                grouped.append({'and': current})
            return {'or': grouped}, idx

        tree, _ = parse_expr(0)
        return tree

    try:
        return parse_tokens(tokens)
    except Exception as e:
        print(f"Error parsing prerequisite string: '{prereq_str}'. Error: {str(e)}")
        return None

# Build a map: courseNum -> { name, prereqTree: logicTree, semesters: ["חורף", "אביב"] }
def build_course_map(courses, semester_label):
    # Hebrew to English key mapping
    hebrew_to_english = {
        'שם מקצוע': 'name',
        'סילבוס': 'syllabus',
        'פקולטה': 'faculty',
        'מסגרת לימודים': 'study_program',
        'מקצועות ללא זיכוי נוסף': 'no_credit_courses',
        'נקודות': 'credits',
        'אחראים': 'lecturer',
        'הערות': 'notes',
        'מועד א': 'exam_a',
        'מועד ב': 'exam_b',
        'בוחן מועד א': 'quiz_a',
    }
    course_map = {}
    for course in courses:
        general = course.get('general', {})
        num = general.get('מספר מקצוע')
        name = general.get('שם מקצוע')
        prereq_str = general.get('מקצועות קדם')
        if num and name:
            if num not in course_map:
                prereq_tree = parse_prerequisite_tree(prereq_str)
                # Map all relevant fields to English keys
                english_data = {}
                for heb_key, eng_key in hebrew_to_english.items():
                    if heb_key in general:
                        english_data[eng_key] = general[heb_key]
                course_map[num] = {
                    **english_data,
                    'prereqTree': prereq_tree,
                    'semesters': [semester_label],
                }
            else:
                if semester_label not in course_map[num]['semesters']:
                    course_map[num]['semesters'].append(semester_label)
    return course_map

# Python version of mergeCourseMaps from courseGraph.js - without 'prereqs' field
def merge_course_maps(winter_map, spring_map):
    merged = winter_map.copy()
    for num, course in spring_map.items():
        if num in merged:
            merged[num]['semesters'] = list(set(merged[num]['semesters'] + course['semesters']))
        else:
            merged[num] = course
    return merged

def main():
    last_semesters = get_last_semesters()
    print("Fetched last semesters from the server")
    
    # Define the public data directory path
    public_data_dir = "public/data"
    
    # Ensure directory exists
    os.makedirs(public_data_dir, exist_ok=True)
    
    # Save the last semesters to JSON file
    with open(f"{public_data_dir}/last_semesters.json", "w") as f:
        json.dump(last_semesters, f, indent=4)
    print("Updated last_semesters.json in public/data directory")
    
    latest_winter, latest_spring = get_latest_two_semesters(last_semesters)
    
    # Save individual semester data and also build merged data
    winter_courses = None
    spring_courses = None
    
    if latest_winter:
        winter_courses = fetch_and_save_courses(latest_winter, f"{public_data_dir}/last_winter_semester.json")
        print("Updated last_winter_semester.json in public/data directory")
    
    if latest_spring:
        spring_courses = fetch_and_save_courses(latest_spring, f"{public_data_dir}/last_spring_semester.json")
        print("Updated last_spring_semester.json in public/data directory")
    
    # Build and merge course maps
    if winter_courses and spring_courses:
        winter_map = build_course_map(winter_courses, 'חורף')
        spring_map = build_course_map(spring_courses, 'אביב')
        merged_map = merge_course_maps(winter_map, spring_map)
        
        # Add the special course
        merged_map["01130013"] = {
            "_id": "01130013",
            "name": "סיווג פיזיקה מכניקה",
            "credits": 0,
            # Explicitly set other common fields to None or empty if they are expected by the consuming code
            "prereqTree": None, 
            "semesters": [], # Or None, depending on how it's handled later
            "syllabus": None,
            "faculty": None,
            "study_program": None,
            "no_credit_courses": None,
            "lecturer": None,
            "notes": None,
            "exam_a": None,
            "exam_b": None,
            "quiz_a": None,
            "isClassificationCourse": True
        }

        # Add the second special course
        merged_map["01130014"] = {
            "_id": "01130014",
            "name": "סיווג פיזיקה חשמל",
            "credits": 0,
            "prereqTree": None,
            "semesters": [],
            "syllabus": None,
            "faculty": None,
            "study_program": None,
            "no_credit_courses": None,
            "lecturer": None,
            "notes": None,
            "exam_a": None,
            "exam_b": None,
            "quiz_a": None,
            "isClassificationCourse": True
        }
        
        # Save the merged map
        with open(f"{public_data_dir}/merged_courses.json", "w", encoding="utf-8") as f:
            json.dump(merged_map, f, ensure_ascii=False, indent=4)
        print("Created merged_courses.json in public/data directory")
    else:
        print("Could not create merged_courses.json because one or both semester data files are missing")

if __name__ == "__main__":
    main()