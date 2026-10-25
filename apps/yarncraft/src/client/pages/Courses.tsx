import { useState } from 'react';
import { COURSES } from '../../domain/courses.ts';
import { buildCatalog } from '../../domain/catalog.ts';
import { useStore } from '../store.tsx';
import { navigate } from '../lib/router.ts';
import { Chip, LevelChip, useToast } from '../components/ui.tsx';
import { StitchSymbol } from '../components/StitchSymbol.tsx';

export function CoursesPage() {
  const { state, toggleLesson } = useStore();
  const toast = useToast();
  const [openCourse, setOpenCourse] = useState<string | null>(COURSES[0]?.id ?? null);
  const catalog = buildCatalog();

  const totalLessons = COURSES.reduce((sum, course) => sum + course.lessons.length, 0);
  const totalDone = Object.values(state.courseProgress).reduce(
    (sum, progress) => sum + progress.completedLessons.length,
    0,
  );

  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Learn</div>
        <h1>From first chain to finished object</h1>
        <p className="lead">
          Five progressive courses, {totalLessons} lessons in total. Each lesson is a single technique
          with a worked example and the mistakes that usually happen. Your progress is saved as you go.
        </p>
        <div className="row" style={{ marginTop: 14 }}>
          <Chip tone="sage">{totalDone} / {totalLessons} lessons complete</Chip>
          {totalDone === 0 && <Chip outline>Start with course one</Chip>}
        </div>
      </div>

      <div className="stack">
        {COURSES.map((course, courseIndex) => {
          const progress = state.courseProgress[course.id];
          const done = progress?.completedLessons.length ?? 0;
          const percent = Math.round((done / course.lessons.length) * 100);
          const isOpen = openCourse === course.id;
          const practice = catalog.find((pattern) => pattern.level === course.level && pattern.minutes <= 45);

          return (
            <div className="course-card" key={course.id}>
              <button
                className="band"
                style={{ background: course.accent, width: '100%', border: 0, textAlign: 'left', cursor: 'pointer' }}
                onClick={() => setOpenCourse(isOpen ? null : course.id)}
                aria-expanded={isOpen}
              >
                <div className="row" style={{ gap: 10 }}>
                  <div>
                    <div className="tiny" style={{ opacity: 0.85, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      Course {courseIndex + 1} · {course.minutes} min
                    </div>
                    <h3>{course.title}</h3>
                    <p>{course.subtitle}</p>
                  </div>
                  <span className="spacer" />
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: 'var(--font)', fontSize: '1.5rem' }}>{percent}%</div>
                    <div className="tiny" style={{ opacity: 0.85 }}>{done}/{course.lessons.length} lessons</div>
                  </div>
                </div>
                <div className="progress-track"><i style={{ width: `${percent}%` }} /></div>
              </button>

              {isOpen && (
                <div>
                  <div className="lesson" style={{ background: '#faf6ec', cursor: 'default' }}>
                    <div style={{ flex: 1 }}>
                      <div className="row-tight" style={{ gap: 6, marginBottom: 4 }}>
                        <LevelChip level={course.level} />
                        {practice && (
                          <button className="btn sm" onClick={() => navigate(`/pattern/${practice.id}`)}>
                            Practise on {practice.title}
                          </button>
                        )}
                      </div>
                      <p className="tiny faint" style={{ margin: 0 }}>
                        Tap a lesson to mark it complete. Click the title again to collapse the course.
                      </p>
                    </div>
                  </div>

                  {course.lessons.map((lesson) => {
                    const complete = progress?.completedLessons.includes(lesson.id) ?? false;
                    return (
                      <div
                        className={`lesson ${complete ? 'done' : ''}`}
                        key={lesson.id}
                        onClick={() => {
                          toggleLesson(course.id, lesson.id);
                          if (!complete) toast.show(`“${lesson.title}” marked complete`);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            toggleLesson(course.id, lesson.id);
                          }
                        }}
                      >
                        <div className="bullet">✓</div>
                        <div style={{ flex: 1 }}>
                          <div className="row-tight" style={{ gap: 8 }}>
                            <h4>{lesson.title}</h4>
                            <span className="tiny faint">{lesson.minutes} min</span>
                          </div>
                          <p>{lesson.goal}</p>
                          {lesson.steps.map((step, index) => (
                            <div key={index} style={{ marginTop: 8 }}>
                              <div className="small" style={{ fontWeight: 600 }}>
                                {index + 1}. {step.title}
                              </div>
                              <div className="small muted">{step.body}</div>
                              {step.diagram && (
                                <div className="step-diagram">
                                  <figure>
                                    <StitchSymbol code={step.diagram} size={30} />
                                    <figcaption>{step.diagram}</figcaption>
                                  </figure>
                                  <figure>
                                    <StitchSymbol code={step.diagram} size={30} />
                                    <figcaption>repeat</figcaption>
                                  </figure>
                                </div>
                              )}
                              {step.tip && <div className="tip">💡 {step.tip}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
