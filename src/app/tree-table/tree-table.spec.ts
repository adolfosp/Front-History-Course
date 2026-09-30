import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { EMPTY, of } from 'rxjs';

import { TreeTable } from './tree-table';
import { VideoWindowService } from '../services/video-window.service';
import { TodoItemFlatNode } from '../domain/TodoItemFlatNode';
import { ApiService } from '../services/api.service';

describe('TreeTable', () => {
  let component: TreeTable;
  let fixture: ComponentFixture<TreeTable>;
  let videoWindows: {
    isAvailable: boolean;
    updates$: typeof EMPTY;
    openPlaylist: jasmine.Spy;
  };

  beforeEach(async () => {
    localStorage.clear();
    videoWindows = {
      isAvailable: false,
      updates$: EMPTY,
      openPlaylist: jasmine.createSpy('openPlaylist').and.resolveTo(null),
    };
    const api = {
      data$: EMPTY,
      updateCourseProgressOnFolder: (_path: string, progress: unknown) =>
        of(progress),
    };

    await TestBed.configureTestingModule({
      imports: [TreeTable],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        { provide: ApiService, useValue: api },
        { provide: VideoWindowService, useValue: videoWindows },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(TreeTable);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the modal playback fallback when video windows are unavailable', () => {
    const node = createVideoNode('Lesson 1.mp4', 'C:/Course/Lesson 1.mp4');
    component.form.patchValue({ caminho: 'C:/Course' });
    component.treeControl.dataNodes = [node];

    component.playVideo(node);

    expect(component.videoUrl).toContain('/video?path=');
    expect(videoWindows.openPlaylist).not.toHaveBeenCalled();
  });

  it('delegates desktop playback with a playlist and leaves modal state empty', () => {
    videoWindows.isAvailable = true;
    const first = createVideoNode(
      'Lesson 1.mp4',
      'C:/Course/Module 1/Lesson 1.mp4'
    );
    const second = createVideoNode(
      'Lesson 2.mp4',
      'C:/Course/Module 1/Lesson 2.mp4'
    );
    component.form.patchValue({ caminho: 'C:/Course' });
    component.treeControl.dataNodes = [first, second];

    component.playVideo(first);

    expect(component.videoUrl).toBe('');
    expect(videoWindows.openPlaylist).toHaveBeenCalledWith({
      coursePath: 'C:/Course',
      playlist: [
        jasmine.objectContaining({
          videoKey: first.path,
          historyKey: first.item,
          title: first.item,
        }),
        jasmine.objectContaining({
          videoKey: second.path,
          historyKey: second.item,
          title: second.item,
        }),
      ],
      startVideoKey: first.path,
      autoplay: true,
    });
  });
});

function createVideoNode(item: string, path: string): TodoItemFlatNode {
  const node = new TodoItemFlatNode();
  node.item = item;
  node.path = path;
  node.level = 0;
  node.expandable = false;
  return node;
}
