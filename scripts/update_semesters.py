import json
import re
import os
import requests

def get_last_semesters():
    last_semesters_url = "https://michael-maltsev.github.io/technion-sap-info-fetcher/last_semesters.json"
    last_semesters_sap = requests.get(last_semesters_url).json()

    last_semesters = {}
    for last_semester in last_semesters_sap:
        semester_code_val = last_semester["semester"] # 200 for Winter, 201 for Spring, 202 for Summer
        # Create YYYYSS format where SS is 01 (Winter), 02 (Spring), 03 (Summer)
        semester_suffix = str(semester_code_val - 200 + 1).zfill(2)
        semester_key = str(last_semester["year"]) + semester_suffix
        last_semesters[semester_key] = {
            "start": last_semester["start"],
            "end": last_semester["end"],
        }
    return last_semesters

# New helper function to get Hebrew semester label
def get_semester_label(semester_suffix):
    if semester_suffix == '01':
        return 'חורף'  # Winter
    elif semester_suffix == '02':
        return 'אביב'  # Spring
    elif semester_suffix == '03':
        return 'קיץ'   # Summer
    else:
        # Potentially raise an error or return a default
        return f"סמסטר {semester_suffix}" # Fallback

# Updated to handle summer semester as well for URL construction
def map_semester_code(semester_key): # semester_key is "YYYYSS"
    year = semester_key[:4]
    sem_suffix = semester_key[4:]
    if sem_suffix == '01':      # Winter
        mapped_sem_code = '200'
    elif sem_suffix == '02':    # Spring
        mapped_sem_code = '201'
    elif sem_suffix == '03':    # Summer
        mapped_sem_code = '202'
    else:
        raise ValueError(f"Unknown semester suffix in semester code: {sem_suffix} from {semester_key}")
    return year, mapped_sem_code

def fetch_and_save_courses(semester_key, filename): # semester_key is "YYYYSS"
    year, mapped_sem_code = map_semester_code(semester_key)
    courses_url = f"https://raw.githubusercontent.com/michael-maltsev/technion-sap-info-fetcher/gh-pages/courses_{year}_{mapped_sem_code}.json"
    response = requests.get(courses_url)
    if response.status_code == 200:
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(response.json(), f, ensure_ascii=False, indent=4)
        return response.json()
    else:
        # It's better to raise an error if a semester's data isn't found, to be handled by the caller
        raise RuntimeError(f"Failed to fetch courses for semester {semester_key} (URL: {courses_url}): HTTP {response.status_code}")

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

# Updated merge_course_maps to iteratively merge a new semester's map into a base map
def merge_course_maps(base_map, new_semester_map):
    """
    Merges course data from new_semester_map into base_map.
    If a course already exists in base_map, its 'semesters' list is updated.
    Otherwise, the new course data is added to base_map.
    Course details (name, credits, prereqTree, etc.) are taken from the first encounter.
    """
    for course_num, new_course_data in new_semester_map.items():
        if course_num in base_map:
            # Course exists, update its semesters list
            if 'semesters' not in base_map[course_num] or not isinstance(base_map[course_num]['semesters'], list):
                base_map[course_num]['semesters'] = [] # Initialize if missing or wrong type
            
            # Add new semester(s) from new_course_data and remove duplicates, then sort
            # new_course_data['semesters'] is expected to be a list like [semester_label]
            existing_semesters = set(base_map[course_num]['semesters'])
            if 'semesters' in new_course_data and isinstance(new_course_data['semesters'], list):
                new_semesters_to_add = set(new_course_data['semesters'])
                existing_semesters.update(new_semesters_to_add)
            base_map[course_num]['semesters'] = sorted(list(existing_semesters))
        else:
            # New course, add it to the base_map
            base_map[course_num] = new_course_data
            # Ensure 'semesters' list exists, even if it's initialized from new_course_data
            if 'semesters' not in base_map[course_num] or not isinstance(base_map[course_num]['semesters'], list):
                 base_map[course_num]['semesters'] = [] # Should be set by build_course_map but as a safeguard
    return base_map # Returns the modified base_map

def main():
    last_semesters = get_last_semesters() # Dict: {"YYYYSS": {"start": ..., "end": ...}}
    print("Fetched last available semester metadata from the server.")
    
    public_data_dir = "public/data"
    public_data_dir = Path(public_data_dir) # Using Path for consistency
    public_data_dir.mkdir(parents=True, exist_ok=True) # Ensures directory exists
    
    last_semesters_filepath = public_data_dir / "last_semesters.json"
    with open(last_semesters_filepath, "w", encoding="utf-8") as f:
        json.dump(last_semesters, f, ensure_ascii=False, indent=4)
    print(f"Updated {last_semesters_filepath}")
    
    all_courses_merged_map = {}
    semesters_processed_count = 0
    semesters_failed_count = 0

    # Sort semester keys to process them chronologically (e.g., "202201", "202202", "202301")
    # This ensures that course data is taken from the earliest available semester.
    sorted_semester_keys = sorted(last_semesters.keys())

    print(f"Found {len(sorted_semester_keys)} semesters to process.")

    for semester_key in sorted_semester_keys: # semester_key is "YYYYSS"
        print(f"Processing semester: {semester_key}...")
        
        try:
            # map_semester_code is used by fetch_and_save_courses internally
            # Construct filename for individual semester data
            year_for_fn, sem_code_for_fn = map_semester_code(semester_key)
            semester_data_filename = public_data_dir / f"courses_{year_for_fn}_{sem_code_for_fn}.json"

            current_semester_courses_data = fetch_and_save_courses(semester_key, semester_data_filename)
            print(f"Fetched and saved courses for semester {semester_key} to {semester_data_filename}")

            semester_code_suffix = semester_key[4:] # e.g., '01', '02', '03'
            semester_label = get_semester_label(semester_code_suffix) # e.g., 'חורף', 'אביב', 'קיץ'
            
            current_semester_course_map = build_course_map(current_semester_courses_data, semester_label)
            all_courses_merged_map = merge_course_maps(all_courses_merged_map, current_semester_course_map)
            semesters_processed_count += 1
            print(f"Successfully processed and merged data for semester {semester_key} ({semester_label} {year_for_fn}).")

        except RuntimeError as e: # From fetch_and_save_courses if HTTP error
            print(f"Warning: Could not fetch data for semester {semester_key}. {e}. Skipping.")
            semesters_failed_count += 1
        except ValueError as e: # From map_semester_code or get_semester_label if unknown semester type
            print(f"Warning: Invalid semester code for {semester_key}. {e}. Skipping.")
            semesters_failed_count += 1
        except Exception as e:
            print(f"Error processing semester {semester_key}: {e}. Skipping.")
            semesters_failed_count += 1
            
    print(f"Finished processing all semesters. Processed: {semesters_processed_count}, Failed/Skipped: {semesters_failed_count}.")

    if semesters_processed_count > 0 and all_courses_merged_map:
        # Add/Update special classification courses, ensuring their semester list is empty
        special_courses_ids = ["01130013", "01130014"]
        special_courses_data = {
            "01130013": {
                "name": "סיווג פיזיקה מכניקה",
                "isClassificationCourse": True
            },
            "01130014": {
                "name": "סיווג פיזיקה חשמל",
                "isClassificationCourse": True
            }
        }

        for course_id in special_courses_ids:
            all_courses_merged_map[course_id] = {
                "_id": course_id,
                "name": special_courses_data[course_id]["name"],
                "credits": 0,
                "prereqTree": None, 
                "semesters": [], # Explicitly empty for classification courses
                "syllabus": None, "faculty": None, "study_program": None,
                "no_credit_courses": None, "lecturer": None, "notes": None,
                "exam_a": None, "exam_b": None, "quiz_a": None,
                "isClassificationCourse": special_courses_data[course_id]["isClassificationCourse"]
            }
        print(f"Added/Updated {len(special_courses_ids)} special classification courses.")

        # Custom: Add specific no_credit_courses exceptions
        custom_no_credit_exceptions = {
            "00340053": ["00340029"] # Course ID: list of no_credit_courses to add
            # Add more exceptions here if needed in the future, e.g.:
            # "COURSE_ID_A": ["NO_CREDIT_A1", "NO_CREDIT_A2"],
        }

        for course_id, no_credit_additions_list in custom_no_credit_exceptions.items():
            if course_id in all_courses_merged_map:
                course_data = all_courses_merged_map[course_id]
                
                current_ids_set = set()
                existing_no_credit_value = course_data.get('no_credit_courses')

                if isinstance(existing_no_credit_value, str):
                    if existing_no_credit_value.strip(): # Check if string is not empty/whitespace
                        current_ids_set.update(existing_no_credit_value.split())
                elif isinstance(existing_no_credit_value, list):
                    # Handle cases where it might have become a list (e.g., from previous script versions)
                    for item in existing_no_credit_value:
                        if isinstance(item, str) and item.strip():
                            current_ids_set.update(item.split()) 
                # If it's None or any other type, current_ids_set remains empty, which is fine.

                # Add new IDs from the custom exceptions list
                for new_id_to_add in no_credit_additions_list:
                    if new_id_to_add.strip(): # Ensure we don't add empty strings
                        current_ids_set.add(new_id_to_add.strip())
                
                # Update the course data with the new space-separated string
                if current_ids_set: # If there are any IDs in the set
                    course_data['no_credit_courses'] = " ".join(sorted(list(current_ids_set)))
                else:
                    # If set is empty, store an empty string or None, based on preference.
                    # Storing empty string for consistency if the field is expected to be a string.
                    course_data['no_credit_courses'] = ""
                
                print(f"Updated no_credit_courses for {course_id} to: \"{course_data['no_credit_courses']}\"")
            else:
                print(f"Warning: Course {course_id} for custom no_credit_courses exception not found in merged map.")
        
        merged_courses_filepath = public_data_dir / "merged_courses.json"
        with open(merged_courses_filepath, "w", encoding="utf-8") as f:
            json.dump(all_courses_merged_map, f, ensure_ascii=False, indent=4)
        print(f"Successfully created/updated {merged_courses_filepath} with data from {semesters_processed_count} semesters.")
    elif not all_courses_merged_map and semesters_processed_count > 0 :
        print("Warning: Processed some semesters, but the final merged map is empty. merged_courses.json will not be updated.")
    else: # semesters_processed_count == 0
        print("No semester data could be successfully processed. merged_courses.json was not created or updated.")

if __name__ == "__main__":
    # Need to import Path here if used in main
    from pathlib import Path
    main()