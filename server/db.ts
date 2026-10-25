import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Course, DocumentChunk, Folder, Material, PastPaper, StudyCalendarEvent, StudySessionLog, TutorMessage, User, UserProgress } from './types.js';
import { generateDeterministicEmbedding } from './ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DB_FILE = path.resolve(DATA_DIR, 'db.json');

export interface DatabaseSchema {
  users: User[];
  activeUserId: string;
  courses: Course[];
  folders: Folder[];
  materials: Material[];
  chunks: DocumentChunk[];
  pastPapers: PastPaper[];
  tutorMessages: TutorMessage[];
  progress: UserProgress[];
  calendarEvents: StudyCalendarEvent[];
  studyLogs: StudySessionLog[];
}

let dbData: DatabaseSchema = {
  users: [],
  activeUserId: 'usr_alex',
  courses: [],
  folders: [],
  materials: [],
  chunks: [],
  pastPapers: [],
  tutorMessages: [],
  progress: [],
  calendarEvents: [],
  studyLogs: [],
};

export function initDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbData = JSON.parse(raw);
      console.log(`[DB] Loaded persistent data: ${dbData.courses.length} courses, ${dbData.materials.length} materials, ${dbData.chunks.length} chunks.`);

      // Upgrade any legacy or mismatched chunk embeddings to 3072-dim verbatim passage embeddings
      let upgraded = false;
      for (const ch of dbData.chunks) {
        if (!ch.embedding || ch.embedding.length !== 3072) {
          ch.embedding = generateDeterministicEmbedding(ch.text);
          upgraded = true;
        }
      }
      if (upgraded) {
        saveDb();
      }
      return;
    }
  } catch (err) {
    console.warn('[DB] Failed reading existing db.json, seeding defaults:', err);
  }

  // Seed default rich knowledge base
  seedDefaults();
  saveDb();
}

function saveDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Failed saving db.json:', err);
  }
}

function seedDefaults() {
  const users: User[] = [
    {
      id: 'usr_alex',
      name: 'Alex Chen',
      email: 'alex.chen@university.edu',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
    {
      id: 'usr_jordan',
      name: 'Jordan Taylor',
      email: 'jordan.t@university.edu',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    },
    {
      id: 'usr_sam',
      name: 'Sam Rivera',
      email: 'sam.rivera@university.edu',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    },
  ];

  const courses: Course[] = [
    {
      id: 'crs_nlp',
      ownerId: 'usr_alex',
      code: 'CS-224N',
      title: 'Natural Language Processing with Deep Learning',
      description: 'Word embeddings, self-attention mechanisms, Transformer architectures, sequence-to-sequence models, and fine-tuning LLMs.',
      color: '#4F46E5', // Indigo
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: 'crs_bio',
      ownerId: 'usr_alex',
      code: 'BIO-101',
      title: 'Cell Biology & Genetics',
      description: 'Cellular membranes, mitochondrial oxidative phosphorylation, signal transduction, DNA replication, and Mendelian inheritance.',
      color: '#0D9488', // Teal
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    },
    {
      id: 'crs_cog',
      ownerId: 'usr_alex',
      code: 'PSYC-210',
      title: 'Cognitive Science & Perception',
      description: 'Visual cortical processing, working memory models, dual-process reasoning theory, and neural basis of decision making.',
      color: '#8B5CF6', // Violet
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ];

  const folders: Folder[] = [
    {
      id: 'fld_nlp_w1',
      courseId: 'crs_nlp',
      ownerId: 'usr_alex',
      name: 'Week 1: Word Vectors & Skip-gram',
      color: '#4F46E5',
      icon: 'Folder',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    },
    {
      id: 'fld_nlp_w2',
      courseId: 'crs_nlp',
      ownerId: 'usr_alex',
      name: 'Week 2: Transformers & Attention',
      color: '#4F46E5',
      icon: 'Folder',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    },
    {
      id: 'fld_nlp_rev',
      courseId: 'crs_nlp',
      ownerId: 'usr_alex',
      name: 'Midterm Exam Revision',
      color: '#4F46E5',
      icon: 'Folder',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
    },
    {
      id: 'fld_bio_m1',
      courseId: 'crs_bio',
      ownerId: 'usr_alex',
      name: 'Module 1: Cellular Energetics',
      color: '#0D9488',
      icon: 'Folder',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
    },
  ];

  const materials: Material[] = [
    {
      id: 'mat_transformer_notes',
      courseId: 'crs_nlp',
      folderId: 'fld_nlp_w2',
      ownerId: 'usr_alex',
      title: 'Attention Is All You Need — Core Architecture Notes',
      filename: 'Attention_Mechanisms_and_Transformers_Lecture4.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1048576,
      extractedTextLength: 3200,
      chunkCount: 3,
      status: 'ready',
      statusMessage: 'Vector Indexed (3 chunks)',
      hasEmbeddings: true,
      isFavorite: true,
      tags: ['Attention', 'Transformers', 'Key-Value', 'Softmax'],
      notes: 'Focus on multi-head attention scaling factor sqrt(d_k) to prevent vanishing gradients in softmax.',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    },
    {
      id: 'mat_word2vec_slides',
      courseId: 'crs_nlp',
      folderId: 'fld_nlp_w1',
      ownerId: 'usr_alex',
      title: 'Word2Vec, Skip-gram & Negative Sampling',
      filename: 'CS224N_Lecture1_Word_Vectors.pptx',
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      sizeBytes: 2097152,
      extractedTextLength: 2600,
      chunkCount: 2,
      status: 'ready',
      statusMessage: 'Vector Indexed (2 chunks)',
      hasEmbeddings: true,
      isFavorite: false,
      tags: ['SkipGram', 'WordVectors', 'Softmax'],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    },
    {
      id: 'mat_bio_mitochondria',
      courseId: 'crs_bio',
      folderId: 'fld_bio_m1',
      ownerId: 'usr_alex',
      title: 'Chemiosmosis and the Electron Transport Chain',
      filename: 'Chapter9_Cellular_Respiration.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 524288,
      extractedTextLength: 2900,
      chunkCount: 2,
      status: 'ready',
      statusMessage: 'Vector Indexed (2 chunks)',
      hasEmbeddings: true,
      isFavorite: true,
      tags: ['ATP', 'ETC', 'Mitochondria'],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
    },
  ];

  const chunks: DocumentChunk[] = [
    {
      chunkId: 'chk_trans_1',
      documentId: 'mat_transformer_notes',
      filename: 'Attention_Mechanisms_and_Transformers_Lecture4.pdf',
      courseId: 'crs_nlp',
      folderId: 'fld_nlp_w2',
      ownerId: 'usr_alex',
      pageOrSlide: 4,
      chunkIndex: 0,
      text: 'Scaled Dot-Product Attention: Attention(Q, K, V) = softmax((Q * K^T) / sqrt(d_k)) * V. The query and key vectors of dimension d_k are multiplied via dot product. When d_k is large, the dot products grow large in magnitude, pushing the softmax function into regions where it has extremely small gradients. To counteract this effect, we scale the dot products by 1 / sqrt(d_k).',
      sourceExcerpt: 'Attention(Q, K, V) = softmax((Q * K^T) / sqrt(d_k)) * V. Scale by 1 / sqrt(d_k) to counteract small gradients in softmax when d_k is large.',
      embedding: generateDeterministicEmbedding('Scaled Dot-Product Attention: Attention(Q, K, V) = softmax((Q * K^T) / sqrt(d_k)) * V. The query and key vectors of dimension d_k are multiplied via dot product. When d_k is large, the dot products grow large in magnitude, pushing the softmax function into regions where it has extremely small gradients. To counteract this effect, we scale the dot products by 1 / sqrt(d_k).'),
      tokenEstimate: 78,
    },
    {
      chunkId: 'chk_trans_2',
      documentId: 'mat_transformer_notes',
      filename: 'Attention_Mechanisms_and_Transformers_Lecture4.pdf',
      courseId: 'crs_nlp',
      folderId: 'fld_nlp_w2',
      ownerId: 'usr_alex',
      pageOrSlide: 7,
      chunkIndex: 1,
      text: 'Multi-Head Attention allows the model to jointly attend to information from different representation subspaces at different positions. Instead of performing a single attention function with d_model-dimensional keys, values, and queries, we linearly project queries, keys, and values h times with different, learned linear projections to d_k, d_k, and d_v dimensions respectively.',
      sourceExcerpt: 'Multi-Head Attention allows the model to jointly attend to information from different representation subspaces at different positions.',
      embedding: generateDeterministicEmbedding('Multi-Head Attention allows the model to jointly attend to information from different representation subspaces at different positions. Instead of performing a single attention function with d_model-dimensional keys, values, and queries, we linearly project queries, keys, and values h times with different, learned linear projections to d_k, d_k, and d_v dimensions respectively.'),
      tokenEstimate: 65,
    },
    {
      chunkId: 'chk_trans_3',
      documentId: 'mat_transformer_notes',
      filename: 'Attention_Mechanisms_and_Transformers_Lecture4.pdf',
      courseId: 'crs_nlp',
      folderId: 'fld_nlp_w2',
      ownerId: 'usr_alex',
      pageOrSlide: 12,
      chunkIndex: 2,
      text: 'Positional Encoding: Since our model contains no recurrence and no convolution, in order for the model to make use of the order of the sequence, we must inject some information about the relative or absolute position of the tokens in the sequence. In the original paper, sinusoidal positional encodings are added to the input embeddings.',
      sourceExcerpt: 'Since model contains no recurrence, we add sinusoidal positional encodings to inject sequence order.',
      embedding: generateDeterministicEmbedding('Positional Encoding: Since our model contains no recurrence and no convolution, in order for the model to make use of the order of the sequence, we must inject some information about the relative or absolute position of the tokens in the sequence. In the original paper, sinusoidal positional encodings are added to the input embeddings.'),
      tokenEstimate: 70,
    },
    {
      chunkId: 'chk_w2v_1',
      documentId: 'mat_word2vec_slides',
      filename: 'CS224N_Lecture1_Word_Vectors.pptx',
      courseId: 'crs_nlp',
      folderId: 'fld_nlp_w1',
      ownerId: 'usr_alex',
      pageOrSlide: 8,
      chunkIndex: 0,
      text: 'Word2Vec Skip-gram Model: For each position t = 1, ..., T, predict context words within a window of size m given center word w_t. Objective function: maximize the average log probability of context words across the entire corpus. Softmax formulation computes conditional probability of outside word given center word.',
      sourceExcerpt: 'Skip-gram predicts context words within a window m given center word w_t to maximize log probability.',
      embedding: generateDeterministicEmbedding('Word2Vec Skip-gram Model: For each position t = 1, ..., T, predict context words within a window of size m given center word w_t. Objective function: maximize the average log probability of context words across the entire corpus. Softmax formulation computes conditional probability of outside word given center word.'),
      tokenEstimate: 62,
    },
    {
      chunkId: 'chk_bio_1',
      documentId: 'mat_bio_mitochondria',
      filename: 'Chapter9_Cellular_Respiration.docx',
      courseId: 'crs_bio',
      folderId: 'fld_bio_m1',
      ownerId: 'usr_alex',
      pageOrSlide: 1,
      chunkIndex: 0,
      text: 'Mitochondrial Electron Transport Chain (ETC): Electrons from NADH and FADH2 pass through four protein complexes (Complex I-IV) in the inner mitochondrial membrane. This electron flow pumps protons (H+) from the matrix into the intermembrane space, generating an electrochemical proton gradient known as the proton-motive force.',
      sourceExcerpt: 'Electrons from NADH and FADH2 drive proton pumping into the intermembrane space, creating the proton-motive force.',
      embedding: generateDeterministicEmbedding('Mitochondrial Electron Transport Chain (ETC): Electrons from NADH and FADH2 pass through four protein complexes (Complex I-IV) in the inner mitochondrial membrane. This electron flow pumps protons (H+) from the matrix into the intermembrane space, generating an electrochemical proton gradient known as the proton-motive force.'),
      tokenEstimate: 68,
    },
  ];

  const pastPapers: PastPaper[] = [
    {
      id: 'pp_nlp_2024',
      courseId: 'crs_nlp',
      folderId: 'fld_nlp_w2',
      ownerId: 'usr_alex',
      title: 'CS-224N Midterm Examination Spring 2024',
      filename: 'CS224N_Spring_2024_Midterm.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1572864,
      year: '2024',
      examTerm: 'Spring Midterm',
      institution: 'Department of Computer Science',
      pageCount: 6,
      extractedTextLength: 4800,
      status: 'ready',
      statusMessage: 'Ready',
      extractedQuestions: [
        {
          questionNumber: '1(a)',
          section: 'Section A: Attention Mechanisms',
          type: 'short_answer',
          prompt: 'State why the dot-product attention score (Q * K^T) is divided by the square root of d_k in Scaled Dot-Product Attention.',
          allocatedMarks: 2,
          markingGuide: '1 mark for noting large values of d_k push dot products to large magnitudes; 1 mark for noting that softmax enters regions with extremely small (vanishing) gradients.',
          sourcePage: 2,
        },
        {
          questionNumber: '1(b)',
          section: 'Section A: Attention Mechanisms',
          type: 'multiple_choice',
          prompt: 'In Multi-Head Attention with 8 heads and model dimension d_model = 512, what is the dimension d_k of each head?',
          options: ['32', '64', '128', '256'],
          allocatedMarks: 1,
          markingGuide: 'Correct answer: 64 (512 / 8 = 64).',
          sourcePage: 2,
        },
        {
          questionNumber: '2',
          section: 'Section B: Sequence Representation',
          type: 'short_essay',
          prompt: 'Explain why pure Transformer encoder models require Positional Encoding, contrasting their positional awareness with recurrent neural networks (RNNs).',
          allocatedMarks: 5,
          markingGuide: 'Award up to 5 marks based on: absence of recurrence/convolutions in self-attention (permutation invariance), requirement to inject sequential token order, and comparison with sequential state passing in RNNs.',
          sourcePage: 4,
        },
      ],
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString(),
    },
  ];

  const progress: UserProgress[] = [
    {
      userId: 'usr_alex',
      courseId: 'crs_nlp',
      totalQuestionsAnswered: 24,
      correctAnswers: 21,
      streakDays: 5,
      lastStudiedAt: new Date().toISOString(),
      topicMastery: {
        'Attention Mechanisms': 92,
        'Word Embeddings': 85,
        'Transformers': 88,
        'Positional Encoding': 78,
      },
    },
    {
      userId: 'usr_alex',
      courseId: 'crs_bio',
      totalQuestionsAnswered: 14,
      correctAnswers: 12,
      streakDays: 3,
      lastStudiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      topicMastery: {
        'Cellular Energetics': 86,
        'Genetics': 75,
      },
    },
  ];

  const calendarEvents: StudyCalendarEvent[] = [
    {
      id: 'evt_1',
      userId: 'usr_alex',
      courseId: 'crs_nlp',
      folderId: 'fld_nlp_w2',
      title: 'Multi-Head Attention & Transformer Deep Dive',
      description: 'Review scaled dot-product proof and complete 5 active recall questions.',
      startTime: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
      endTime: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(),
      durationMinutes: 45,
      isRecurring: true,
      recurrenceRule: 'daily',
      reminderMinutesBefore: 15,
      completed: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'evt_2',
      userId: 'usr_alex',
      courseId: 'crs_nlp',
      folderId: 'fld_nlp_rev',
      title: 'CS224N Past Paper Mock Simulation',
      description: 'Timed 30-minute exam simulation using 2024 Midterm style calibration.',
      startTime: new Date(Date.now() + 1000 * 60 * 60 * 28).toISOString(),
      endTime: new Date(Date.now() + 1000 * 60 * 60 * 29).toISOString(),
      durationMinutes: 30,
      isRecurring: false,
      reminderMinutesBefore: 30,
      completed: false,
      createdAt: new Date().toISOString(),
    },
  ];

  const studyLogs: StudySessionLog[] = [
    {
      id: 'log_1',
      userId: 'usr_alex',
      courseId: 'crs_nlp',
      folderId: 'fld_nlp_w2',
      durationMinutes: 45,
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      notes: 'Completed 45m deep focus session on Scaled Dot-Product Attention proof.',
    },
    {
      id: 'log_2',
      userId: 'usr_alex',
      courseId: 'crs_nlp',
      folderId: 'fld_nlp_w1',
      durationMinutes: 25,
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      notes: 'Pomodoro interval: Word2Vec Skip-gram objective function derivations.',
    },
  ];

  dbData = {
    users,
    activeUserId: 'usr_alex',
    courses,
    folders,
    materials,
    chunks,
    pastPapers,
    tutorMessages: [],
    progress,
    calendarEvents,
    studyLogs,
  };
}

export const db = {
  get data() {
    return dbData;
  },
  save: saveDb,
};
