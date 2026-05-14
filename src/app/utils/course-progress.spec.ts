import { isStoredCourseProgress } from './course-progress';

describe('course progress storage helpers', () => {
  it('recognizes the current course progress shape', () => {
    expect(
      isStoredCourseProgress(
        JSON.stringify({
          bannerImage: null,
          history: {},
        })
      )
    ).toBeTrue();
  });

  it('recognizes legacy history-only course progress', () => {
    expect(
      isStoredCourseProgress(
        JSON.stringify({
          'Modulo/aula.mp4': {
            watched: true,
            currentTime: 10,
          },
        })
      )
    ).toBeTrue();
  });

  it('ignores non-course preferences stored in localStorage', () => {
    expect(isStoredCourseProgress('dark')).toBeFalse();
    expect(isStoredCourseProgress(JSON.stringify(true))).toBeFalse();
  });
});
