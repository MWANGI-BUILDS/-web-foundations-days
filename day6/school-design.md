# School Database Design

## Tables

- `students` stores each student's ID, name, and unique email address.
- `courses` stores each course's ID and unique name.
- `enrolments` records the fact that a student takes a course, along with that student's grade for the course. Its foreign keys link to `students` and `courses`, and its unique student/course pair prevents duplicate enrolments.

## Relationships

One student can have many enrolments, and one course can have many enrolments; each enrolment belongs to exactly one student and one course. Therefore, students and courses have a many-to-many relationship. The `enrolments` join table is needed to represent each student-course pairing and store data about that relationship, such as the grade.

## Index

I would add an index on `enrolments(course_id)` so the database can find the students enrolled in a particular course more efficiently. The unique constraint on `(student_id, course_id)` already provides an index useful for student-first lookups, but its column order is less helpful when searching by course alone.

## SQL or NoSQL?

I would choose a relational SQL database for this system. Students, courses, and enrolments have clear relationships, and the schema can enforce important rules such as unique emails, valid foreign keys, and one enrolment per student and course. SQL joins and grouping also make it straightforward to answer questions such as which students are in a course or how many students each course has. These constraints and queries suit the structured, connected data better than a NoSQL model.