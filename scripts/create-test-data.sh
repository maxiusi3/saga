#!/bin/bash

# 创建测试数据脚本 - Saga家族传记系统
# 为人工测试生成真实的测试数据

set -e

echo "🎭 创建测试数据 - Saga家族传记系统"
echo "=================================="

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 检查是否在正确的目录
if [ ! -f "package.json" ]; then
    log_error "请在项目根目录运行此脚本"
    exit 1
fi

# 创建测试数据目录
create_test_directories() {
    log_info "创建测试数据目录..."
    
    mkdir -p test-data/audio
    mkdir -p test-data/images
    mkdir -p test-data/exports
    mkdir -p test-data/users
    mkdir -p test-data/projects
    mkdir -p test-data/stories
    mkdir -p test-data/prompts
    mkdir -p test-data/performance
    mkdir -p test-data/api-tests
    mkdir -p test-data/reports
    
    log_success "测试数据目录创建完成"
}

# 生成测试用户数据
generate_test_users() {
    log_info "生成测试用户数据..."
    
    cat > test-data/users/test-users.json << 'EOF'
{
  "facilitators": [
    {
      "id": "facilitator-001",
      "email": "zhang.wei@test.com",
      "name": "张伟",
      "role": "facilitator",
      "password": "TestPassword123!",
      "resourceWallet": {
        "projectVouchers": 2,
        "facilitatorSeats": 3,
        "storytellerSeats": 4
      },
      "profile": {
        "avatar": "/test-data/images/avatar-zhang-wei.jpg",
        "bio": "家族历史爱好者，希望记录父母的人生故事",
        "location": "北京市",
        "joinedDate": "2024-01-15"
      }
    },
    {
      "id": "facilitator-002", 
      "email": "li.ming@test.com",
      "name": "李明",
      "role": "facilitator",
      "password": "TestPassword123!",
      "resourceWallet": {
        "projectVouchers": 1,
        "facilitatorSeats": 2,
        "storytellerSeats": 2
      },
      "profile": {
        "avatar": "/test-data/images/avatar-li-ming.jpg",
        "bio": "想要为孩子们保存爷爷奶奶的故事",
        "location": "上海市",
        "joinedDate": "2024-02-20"
      }
    },
    {
      "id": "facilitator-003",
      "email": "wang.xiaoli@test.com", 
      "name": "王小丽",
      "role": "facilitator",
      "password": "TestPassword123!",
      "resourceWallet": {
        "projectVouchers": 0,
        "facilitatorSeats": 1,
        "storytellerSeats": 1
      },
      "profile": {
        "avatar": "/test-data/images/avatar-wang-xiaoli.jpg",
        "bio": "三个孩子的妈妈，想记录家族传统",
        "location": "广州市",
        "joinedDate": "2024-03-10"
      }
    }
  ],
  "storytellers": [
    {
      "id": "storyteller-001",
      "email": "zhang.jianguo@test.com",
      "name": "张建国",
      "role": "storyteller", 
      "password": "TestPassword123!",
      "profile": {
        "avatar": "/test-data/images/avatar-zhang-jianguo.jpg",
        "bio": "退休教师，经历了改革开放的全过程",
        "birthYear": 1945,
        "location": "北京市",
        "occupation": "退休教师",
        "interests": ["读书", "书法", "园艺"]
      }
    },
    {
      "id": "storyteller-002",
      "email": "liu.meifeng@test.com", 
      "name": "刘美凤",
      "role": "storyteller",
      "password": "TestPassword123!",
      "profile": {
        "avatar": "/test-data/images/avatar-liu-meifeng.jpg",
        "bio": "退休护士，见证了医疗事业的发展",
        "birthYear": 1948,
        "location": "北京市", 
        "occupation": "退休护士",
        "interests": ["烹饪", "太极拳", "养花"]
      }
    },
    {
      "id": "storyteller-003",
      "email": "li.daqiang@test.com",
      "name": "李大强", 
      "role": "storyteller",
      "password": "TestPassword123!",
      "profile": {
        "avatar": "/test-data/images/avatar-li-daqiang.jpg",
        "bio": "退休工人，参与了多个重大工程建设",
        "birthYear": 1950,
        "location": "上海市",
        "occupation": "退休工人", 
        "interests": ["象棋", "钓鱼", "听戏"]
      }
    },
    {
      "id": "storyteller-004",
      "email": "chen.xiulan@test.com",
      "name": "陈秀兰",
      "role": "storyteller",
      "password": "TestPassword123!", 
      "profile": {
        "avatar": "/test-data/images/avatar-chen-xiulan.jpg",
        "bio": "退休会计，管理家庭财务几十年",
        "birthYear": 1952,
        "location": "上海市",
        "occupation": "退休会计",
        "interests": ["编织", "广场舞", "旅游"]
      }
    }
  ]
}
EOF
    
    log_success "测试用户数据生成完成"
}

# 生成测试项目数据
generate_test_projects() {
    log_info "生成测试项目数据..."
    
    cat > test-data/projects/test-projects.json << 'EOF'
{
  "projects": [
    {
      "id": "project-001",
      "name": "张家三代人的故事",
      "description": "记录爷爷奶奶从建国到改革开放的人生经历，为孩子们留下珍贵的家族记忆",
      "createdBy": "facilitator-001",
      "createdAt": "2024-01-20T10:00:00Z",
      "status": "active",
      "facilitators": ["facilitator-001"],
      "storytellers": ["storyteller-001", "storyteller-002"],
      "settings": {
        "language": "zh-CN",
        "privacy": "family-only",
        "notifications": true,
        "autoTranscribe": true
      },
      "statistics": {
        "totalStories": 15,
        "totalDuration": 1800,
        "completedChapters": 2,
        "totalChapters": 6
      }
    },
    {
      "id": "project-002", 
      "name": "李家父母的人生足迹",
      "description": "记录父母从农村到城市的奋斗历程，保存他们的智慧和经验",
      "createdBy": "facilitator-002",
      "createdAt": "2024-02-25T14:30:00Z",
      "status": "active",
      "facilitators": ["facilitator-002"],
      "storytellers": ["storyteller-003", "storyteller-004"],
      "settings": {
        "language": "zh-CN", 
        "privacy": "family-only",
        "notifications": true,
        "autoTranscribe": true
      },
      "statistics": {
        "totalStories": 8,
        "totalDuration": 960,
        "completedChapters": 1,
        "totalChapters": 6
      }
    },
    {
      "id": "project-003",
      "name": "王家传统文化传承",
      "description": "记录家族传统文化、节日习俗和祖辈的智慧",
      "createdBy": "facilitator-003",
      "createdAt": "2024-03-15T09:15:00Z", 
      "status": "active",
      "facilitators": ["facilitator-003"],
      "storytellers": [],
      "settings": {
        "language": "zh-CN",
        "privacy": "family-only", 
        "notifications": true,
        "autoTranscribe": true
      },
      "statistics": {
        "totalStories": 0,
        "totalDuration": 0,
        "completedChapters": 0,
        "totalChapters": 6
      }
    }
  ]
}
EOF
    
    log_success "测试项目数据生成完成"
}

# 生成测试故事数据
generate_test_stories() {
    log_info "生成测试故事数据..."
    
    cat > test-data/stories/test-stories.json << 'EOF'
{
  "stories": [
    {
      "id": "story-001",
      "projectId": "project-001",
      "storytellerId": "storyteller-001",
      "chapterId": "chapter-001",
      "promptId": "prompt-001",
      "title": "我的童年记忆",
      "audioUrl": "/test-data/audio/story-001-childhood-memories.mp3",
      "transcript": "我是1945年出生的，那时候正是抗日战争结束的时候。我记得小时候家里很穷，但是父母总是想办法让我们兄弟姐妹都能上学。我的父亲是个木匠，手艺很好，经常帮邻居修理家具。母亲则在家里照顾我们，还要做一些针线活贴补家用。虽然生活艰苦，但是我们一家人很团结，互相帮助。我记得最深刻的是，每到过年的时候，母亲总是会想办法给我们做新衣服，虽然布料不好，但是她的手艺很巧，做出来的衣服我们都很喜欢。",
      "duration": 120,
      "createdAt": "2024-01-21T10:30:00Z",
      "metadata": {
        "recordingQuality": "good",
        "backgroundNoise": "low",
        "transcriptionAccuracy": 0.95,
        "language": "zh-CN"
      },
      "interactions": [
        {
          "id": "interaction-001",
          "type": "comment",
          "userId": "facilitator-001",
          "content": "爷爷，您说的新衣服让我想起了小时候您给我做的小木马，您的手艺真的很棒！",
          "createdAt": "2024-01-21T11:00:00Z"
        },
        {
          "id": "interaction-002", 
          "type": "follow-up-question",
          "userId": "facilitator-001",
          "content": "爷爷，能详细说说您父亲的木匠手艺吗？他都做过哪些家具？",
          "createdAt": "2024-01-21T11:15:00Z"
        }
      ]
    },
    {
      "id": "story-002",
      "projectId": "project-001", 
      "storytellerId": "storyteller-002",
      "chapterId": "chapter-001",
      "promptId": "prompt-002",
      "title": "家族的传统节日",
      "audioUrl": "/test-data/audio/story-002-family-traditions.mp3",
      "transcript": "我们家过春节有很多传统。从腊月二十三开始，就要开始准备了。先是扫房子，把家里打扫得干干净净。然后要准备年货，买肉、买鱼、买各种干果。我记得我的婆婆特别会做年糕，每年都要做很多，分给邻居们。除夕那天，全家人都要聚在一起包饺子，孩子们负责擀皮，大人们包馅。包饺子的时候，还要在几个饺子里放硬币，谁吃到了就代表来年有好运。大年初一早上，孩子们要给长辈拜年，长辈会给压岁钱。这些传统一直延续到现在，虽然生活条件好了，但是这些习俗我们还是保持着。",
      "duration": 150,
      "createdAt": "2024-01-22T15:20:00Z",
      "metadata": {
        "recordingQuality": "excellent",
        "backgroundNoise": "very-low", 
        "transcriptionAccuracy": 0.98,
        "language": "zh-CN"
      },
      "interactions": [
        {
          "id": "interaction-003",
          "type": "comment",
          "userId": "facilitator-001",
          "content": "奶奶，您说的年糕我现在还记得味道，真的特别香甜！",
          "createdAt": "2024-01-22T16:00:00Z"
        }
      ]
    },
    {
      "id": "story-003",
      "projectId": "project-002",
      "storytellerId": "storyteller-003", 
      "chapterId": "chapter-001",
      "promptId": "prompt-001",
      "title": "从农村到城市的求学路",
      "audioUrl": "/test-data/audio/story-003-education-journey.mp3",
      "transcript": "我是1950年出生在一个小山村里。那时候农村的条件很艰苦，很多孩子都上不了学。但是我的父母很重视教育，他们说再苦再累也要让我读书。我记得小学的时候，每天要走十几里山路才能到学校。冬天的时候，山路上都是雪，脚都冻得没有知觉了。但是我从来没有想过要放弃，因为我知道只有读书才能改变命运。初中的时候，我考上了县里的中学，要住校。家里给我准备了一个小木箱，里面装着换洗的衣服和一些咸菜。每个月回家一次，母亲总是给我准备很多好吃的。高中毕业后，我考上了大学，成为了村里第一个大学生。",
      "duration": 180,
      "createdAt": "2024-02-26T09:45:00Z",
      "metadata": {
        "recordingQuality": "good",
        "backgroundNoise": "medium",
        "transcriptionAccuracy": 0.92,
        "language": "zh-CN"
      },
      "interactions": []
    }
  ]
}
EOF
    
    log_success "测试故事数据生成完成"
}

# 生成测试提示数据
generate_test_prompts() {
    log_info "生成测试提示数据..."
    
    cat > test-data/prompts/test-prompts.json << 'EOF'
{
  "chapters": [
    {
      "id": "chapter-001",
      "name": "童年与家庭",
      "description": "记录童年时光和家庭生活的美好回忆",
      "orderIndex": 1,
      "prompts": [
        {
          "id": "prompt-001",
          "text": "请告诉我您最早的童年记忆，那时候您几岁？发生了什么事？",
          "audioUrl": "/test-data/audio/prompt-001.mp3",
          "orderIndex": 1
        },
        {
          "id": "prompt-002", 
          "text": "您能描述一下小时候的家庭传统或节日庆祝方式吗？",
          "audioUrl": "/test-data/audio/prompt-002.mp3",
          "orderIndex": 2
        },
        {
          "id": "prompt-003",
          "text": "您的父母是什么样的人？他们对您的影响最大的是什么？",
          "audioUrl": "/test-data/audio/prompt-003.mp3", 
          "orderIndex": 3
        }
      ]
    },
    {
      "id": "chapter-002",
      "name": "求学与成长",
      "description": "记录求学经历和青少年时期的成长故事",
      "orderIndex": 2,
      "prompts": [
        {
          "id": "prompt-004",
          "text": "请说说您的求学经历，印象最深刻的老师或同学是谁？",
          "audioUrl": "/test-data/audio/prompt-004.mp3",
          "orderIndex": 1
        },
        {
          "id": "prompt-005",
          "text": "您年轻时有什么梦想？这些梦想后来实现了吗？",
          "audioUrl": "/test-data/audio/prompt-005.mp3",
          "orderIndex": 2
        }
      ]
    },
    {
      "id": "chapter-003", 
      "name": "工作与事业",
      "description": "记录职业生涯和工作中的重要经历",
      "orderIndex": 3,
      "prompts": [
        {
          "id": "prompt-006",
          "text": "请介绍一下您的第一份工作，当时的工作环境是什么样的？",
          "audioUrl": "/test-data/audio/prompt-006.mp3",
          "orderIndex": 1
        },
        {
          "id": "prompt-007",
          "text": "在您的职业生涯中，最有成就感的一件事是什么？",
          "audioUrl": "/test-data/audio/prompt-007.mp3",
          "orderIndex": 2
        }
      ]
    }
  ]
}
EOF
    
    log_success "测试提示数据生成完成"
}

# 创建测试音频文件（静音文件用于测试）
create_test_audio_files() {
    log_info "创建测试音频文件..."
    
    # 检查是否安装了ffmpeg
    if command -v ffmpeg &> /dev/null; then
        # 创建不同长度的测试音频文件
        ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 120 -q:a 9 -acodec libmp3lame test-data/audio/story-001-childhood-memories.mp3 -y 2>/dev/null
        ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 150 -q:a 9 -acodec libmp3lame test-data/audio/story-002-family-traditions.mp3 -y 2>/dev/null
        ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 180 -q:a 9 -acodec libmp3lame test-data/audio/story-003-education-journey.mp3 -y 2>/dev/null
        
        # 创建提示音频文件
        ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 10 -q:a 9 -acodec libmp3lame test-data/audio/prompt-001.mp3 -y 2>/dev/null
        ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 12 -q:a 9 -acodec libmp3lame test-data/audio/prompt-002.mp3 -y 2>/dev/null
        ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 11 -q:a 9 -acodec libmp3lame test-data/audio/prompt-003.mp3 -y 2>/dev/null
        ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 13 -q:a 9 -acodec libmp3lame test-data/audio/prompt-004.mp3 -y 2>/dev/null
        ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 10 -q:a 9 -acodec libmp3lame test-data/audio/prompt-005.mp3 -y 2>/dev/null
        ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 14 -q:a 9 -acodec libmp3lame test-data/audio/prompt-006.mp3 -y 2>/dev/null
        ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 12 -q:a 9 -acodec libmp3lame test-data/audio/prompt-007.mp3 -y 2>/dev/null
        
        # 创建不同质量的测试录音文件
        ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 60 -q:a 9 -acodec libmp3lame test-data/audio/test-recording-good-quality.mp3 -y 2>/dev/null
        ffmpeg -f lavfi -i anullsrc=r=22050:cl=mono -t 60 -q:a 7 -acodec libmp3lame test-data/audio/test-recording-medium-quality.mp3 -y 2>/dev/null
        ffmpeg -f lavfi -i anullsrc=r=16000:cl=mono -t 60 -q:a 5 -acodec libmp3lame test-data/audio/test-recording-low-quality.mp3 -y 2>/dev/null
        
        log_success "测试音频文件创建完成"
    else
        log_warning "未安装ffmpeg，跳过音频文件创建"
        # 创建空的占位文件
        touch test-data/audio/story-001-childhood-memories.mp3
        touch test-data/audio/story-002-family-traditions.mp3
        touch test-data/audio/story-003-education-journey.mp3
        touch test-data/audio/prompt-001.mp3
        touch test-data/audio/prompt-002.mp3
        touch test-data/audio/prompt-003.mp3
        touch test-data/audio/prompt-004.mp3
        touch test-data/audio/prompt-005.mp3
        touch test-data/audio/prompt-006.mp3
        touch test-data/audio/prompt-007.mp3
        touch test-data/audio/test-recording-good-quality.mp3
        touch test-data/audio/test-recording-medium-quality.mp3
        touch test-data/audio/test-recording-low-quality.mp3
    fi
}

# 创建测试图片文件
create_test_images() {
    log_info "创建测试图片文件..."
    
    # 检查是否安装了ImageMagick
    if command -v convert &> /dev/null; then
        # 创建用户头像占位图
        convert -size 200x200 xc:lightblue -pointsize 20 -fill black -gravity center -annotate +0+0 "张伟" test-data/images/avatar-zhang-wei.jpg 2>/dev/null
        convert -size 200x200 xc:lightgreen -pointsize 20 -fill black -gravity center -annotate +0+0 "李明" test-data/images/avatar-li-ming.jpg 2>/dev/null
        convert -size 200x200 xc:lightpink -pointsize 20 -fill black -gravity center -annotate +0+0 "王小丽" test-data/images/avatar-wang-xiaoli.jpg 2>/dev/null
        convert -size 200x200 xc:lightyellow -pointsize 20 -fill black -gravity center -annotate +0+0 "张建国" test-data/images/avatar-zhang-jianguo.jpg 2>/dev/null
        convert -size 200x200 xc:lightcyan -pointsize 20 -fill black -gravity center -annotate +0+0 "刘美凤" test-data/images/avatar-liu-meifeng.jpg 2>/dev/null
        convert -size 200x200 xc:lightgray -pointsize 20 -fill black -gravity center -annotate +0+0 "李大强" test-data/images/avatar-li-daqiang.jpg 2>/dev/null
        convert -size 200x200 xc:lightcoral -pointsize 20 -fill black -gravity center -annotate +0+0 "陈秀兰" test-data/images/avatar-chen-xiulan.jpg 2>/dev/null
        
        # 创建故事相关的测试图片
        convert -size 400x300 xc:seashell -pointsize 16 -fill black -gravity center -annotate +0+0 "童年老照片" test-data/images/childhood-photo.jpg 2>/dev/null
        convert -size 400x300 xc:wheat -pointsize 16 -fill black -gravity center -annotate +0+0 "家庭合影" test-data/images/family-photo.jpg 2>/dev/null
        convert -size 400x300 xc:lavender -pointsize 16 -fill black -gravity center -annotate +0+0 "工作照片" test-data/images/work-photo.jpg 2>/dev/null
        
        log_success "测试图片文件创建完成"
    else
        log_warning "未安装ImageMagick，跳过图片文件创建"
        # 创建空的占位文件
        touch test-data/images/avatar-zhang-wei.jpg
        touch test-data/images/avatar-li-ming.jpg
        touch test-data/images/avatar-wang-xiaoli.jpg
        touch test-data/images/avatar-zhang-jianguo.jpg
        touch test-data/images/avatar-liu-meifeng.jpg
        touch test-data/images/avatar-li-daqiang.jpg
        touch test-data/images/avatar-chen-xiulan.jpg
        touch test-data/images/childhood-photo.jpg
        touch test-data/images/family-photo.jpg
        touch test-data/images/work-photo.jpg
    fi
}

# 创建数据库种子脚本
create_database_seeds() {
    log_info "创建数据库种子脚本..."
    
    cat > packages/backend/seeds/99_test_data.js << 'EOF'
const fs = require('fs');
const path = require('path');

// 读取测试数据文件
const testUsersPath = path.join(__dirname, '../../../test-data/users/test-users.json');
const testProjectsPath = path.join(__dirname, '../../../test-data/projects/test-projects.json');
const testStoriesPath = path.join(__dirname, '../../../test-data/stories/test-stories.json');
const testPromptsPath = path.join(__dirname, '../../../test-data/prompts/test-prompts.json');

exports.seed = async function(knex) {
  // 清理现有测试数据
  await knex('interactions').del();
  await knex('stories').del();
  await knex('user_prompts').del();
  await knex('project_prompt_state').del();
  await knex('project_roles').del();
  await knex('projects').del();
  await knex('seat_transactions').del();
  await knex('user_resource_wallets').del();
  await knex('users').del();
  await knex('prompts').del();
  await knex('chapters').del();

  // 读取测试数据
  let testUsers, testProjects, testStories, testPrompts;
  
  try {
    if (fs.existsSync(testUsersPath)) {
      testUsers = JSON.parse(fs.readFileSync(testUsersPath, 'utf8'));
    }
    if (fs.existsSync(testProjectsPath)) {
      testProjects = JSON.parse(fs.readFileSync(testProjectsPath, 'utf8'));
    }
    if (fs.existsSync(testStoriesPath)) {
      testStories = JSON.parse(fs.readFileSync(testStoriesPath, 'utf8'));
    }
    if (fs.existsSync(testPromptsPath)) {
      testPrompts = JSON.parse(fs.readFileSync(testPromptsPath, 'utf8'));
    }
  } catch (error) {
    console.log('测试数据文件不存在或格式错误，跳过测试数据种子');
    return;
  }

  // 插入章节数据
  if (testPrompts && testPrompts.chapters) {
    for (const chapter of testPrompts.chapters) {
      await knex('chapters').insert({
        id: chapter.id,
        name: chapter.name,
        description: chapter.description,
        order_index: chapter.orderIndex,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      });

      // 插入提示数据
      for (const prompt of chapter.prompts) {
        await knex('prompts').insert({
          id: prompt.id,
          chapter_id: chapter.id,
          text: prompt.text,
          audio_url: prompt.audioUrl,
          order_index: prompt.orderIndex,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    }
  }

  // 插入用户数据
  if (testUsers) {
    const allUsers = [...testUsers.facilitators, ...testUsers.storytellers];
    
    for (const user of allUsers) {
      await knex('users').insert({
        id: user.id,
        email: user.email,
        name: user.name,
        password_hash: '$2b$10$example.hash.for.testing.purposes.only',
        avatar_url: user.profile?.avatar,
        bio: user.profile?.bio,
        location: user.profile?.location,
        birth_year: user.profile?.birthYear,
        occupation: user.profile?.occupation,
        interests: user.profile?.interests ? JSON.stringify(user.profile.interests) : null,
        created_at: user.profile?.joinedDate ? new Date(user.profile.joinedDate) : new Date(),
        updated_at: new Date()
      });

      // 插入资源钱包数据（仅协调员）
      if (user.role === 'facilitator' && user.resourceWallet) {
        await knex('user_resource_wallets').insert({
          user_id: user.id,
          project_vouchers: user.resourceWallet.projectVouchers,
          facilitator_seats: user.resourceWallet.facilitatorSeats,
          storyteller_seats: user.resourceWallet.storytellerSeats,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    }
  }

  // 插入项目数据
  if (testProjects && testProjects.projects) {
    for (const project of testProjects.projects) {
      await knex('projects').insert({
        id: project.id,
        name: project.name,
        description: project.description,
        created_by: project.createdBy,
        status: project.status,
        settings: JSON.stringify(project.settings),
        created_at: new Date(project.createdAt),
        updated_at: new Date()
      });

      // 插入项目角色
      for (const facilitatorId of project.facilitators) {
        await knex('project_roles').insert({
          id: `role-${project.id}-${facilitatorId}`,
          project_id: project.id,
          user_id: facilitatorId,
          role: 'facilitator',
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      for (const storytellerId of project.storytellers) {
        await knex('project_roles').insert({
          id: `role-${project.id}-${storytellerId}`,
          project_id: project.id,
          user_id: storytellerId,
          role: 'storyteller',
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      // 插入项目提示状态
      await knex('project_prompt_state').insert({
        project_id: project.id,
        current_chapter_id: 'chapter-001',
        current_prompt_index: 0,
        last_prompt_delivered_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      });
    }
  }

  // 插入故事数据
  if (testStories && testStories.stories) {
    for (const story of testStories.stories) {
      await knex('stories').insert({
        id: story.id,
        project_id: story.projectId,
        user_id: story.storytellerId,
        chapter_id: story.chapterId,
        prompt_id: story.promptId,
        title: story.title,
        audio_url: story.audioUrl,
        transcript: story.transcript,
        duration: story.duration,
        metadata: JSON.stringify(story.metadata),
        created_at: new Date(story.createdAt),
        updated_at: new Date()
      });

      // 插入交互数据
      if (story.interactions) {
        for (const interaction of story.interactions) {
          await knex('interactions').insert({
            id: interaction.id,
            story_id: story.id,
            user_id: interaction.userId,
            type: interaction.type,
            content: interaction.content,
            created_at: new Date(interaction.createdAt),
            updated_at: new Date()
          });

          // 如果是跟进问题，插入用户提示
          if (interaction.type === 'follow-up-question') {
            await knex('user_prompts').insert({
              id: `user-prompt-${interaction.id}`,
              project_id: story.projectId,
              created_by: interaction.userId,
              parent_story_id: story.id,
              text: interaction.content,
              priority: 1,
              is_delivered: false,
              created_at: new Date(interaction.createdAt),
              updated_at: new Date()
            });
          }
        }
      }
    }
  }

  console.log('✅ 测试数据种子插入完成');
};
EOF
    
    log_success "数据库种子脚本创建完成"
}

# 创建API测试脚本
create_api_test_script() {
    log_info "创建API测试脚本..."
    
    cat > scripts/test-api-endpoints.sh << 'EOF'
#!/bin/bash

# API端点测试脚本
# 测试所有主要的API端点

set -e

API_BASE_URL="http://localhost:3001/api"
TEST_TOKEN=""

echo "🔗 测试API端点"
echo "=============="

# 颜色输出
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 测试健康检查
test_health_check() {
    log_info "测试健康检查端点..."
    
    response=$(curl -s -w "%{http_code}" -o /tmp/health_response.json "$API_BASE_URL/health")
    
    if [ "$response" = "200" ]; then
        log_success "健康检查端点正常"
    else
        log_error "健康检查端点失败 (HTTP $response)"
    fi
}

# 测试用户认证
test_authentication() {
    log_info "测试用户认证端点..."
    
    # 测试登录
    login_response=$(curl -s -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d '{"email":"zhang.wei@test.com","password":"TestPassword123!"}' \
        -o /tmp/login_response.json \
        "$API_BASE_URL/auth/login")
    
    if [ "$login_response" = "200" ]; then
        TEST_TOKEN=$(cat /tmp/login_response.json | grep -o '"token":"[^"]*' | cut -d'"' -f4)
        log_success "用户登录成功"
    else
        log_error "用户登录失败 (HTTP $login_response)"
    fi
}

# 测试项目API
test_projects_api() {
    log_info "测试项目API端点..."
    
    if [ -z "$TEST_TOKEN" ]; then
        log_error "需要认证令牌，跳过项目API测试"
        return
    fi
    
    # 获取项目列表
    projects_response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $TEST_TOKEN" \
        -o /tmp/projects_response.json \
        "$API_BASE_URL/projects")
    
    if [ "$projects_response" = "200" ]; then
        log_success "获取项目列表成功"
    else
        log_error "获取项目列表失败 (HTTP $projects_response)"
    fi
}

# 测试故事API
test_stories_api() {
    log_info "测试故事API端点..."
    
    if [ -z "$TEST_TOKEN" ]; then
        log_error "需要认证令牌，跳过故事API测试"
        return
    fi
    
    # 获取故事列表
    stories_response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $TEST_TOKEN" \
        -o /tmp/stories_response.json \
        "$API_BASE_URL/stories")
    
    if [ "$stories_response" = "200" ]; then
        log_success "获取故事列表成功"
    else
        log_error "获取故事列表失败 (HTTP $stories_response)"
    fi
}

# 测试提示API
test_prompts_api() {
    log_info "测试提示API端点..."
    
    if [ -z "$TEST_TOKEN" ]; then
        log_error "需要认证令牌，跳过提示API测试"
        return
    fi
    
    # 获取下一个提示
    prompt_response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $TEST_TOKEN" \
        -o /tmp/prompt_response.json \
        "$API_BASE_URL/prompts/next/project-001")
    
    if [ "$prompt_response" = "200" ]; then
        log_success "获取提示成功"
    else
        log_error "获取提示失败 (HTTP $prompt_response)"
    fi
}

# 测试钱包API
test_wallet_api() {
    log_info "测试钱包API端点..."
    
    if [ -z "$TEST_TOKEN" ]; then
        log_error "需要认证令牌，跳过钱包API测试"
        return
    fi
    
    # 获取钱包余额
    wallet_response=$(curl -s -w "%{http_code}" \
        -H "Authorization: Bearer $TEST_TOKEN" \
        -o /tmp/wallet_response.json \
        "$API_BASE_URL/wallets/facilitator-001")
    
    if [ "$wallet_response" = "200" ]; then
        log_success "获取钱包余额成功"
    else
        log_error "获取钱包余额失败 (HTTP $wallet_response)"
    fi
}

# 运行所有测试
main() {
    echo "开始API端点测试..."
    echo ""
    
    test_health_check
    test_authentication
    test_projects_api
    test_stories_api
    test_prompts_api
    test_wallet_api
    
    echo ""
    echo "API端点测试完成"
    
    # 清理临时文件
    rm -f /tmp/*_response.json
}

main "$@"
EOF
    
    chmod +x scripts/test-api-endpoints.sh
    log_success "API测试脚本创建完成"
}

# 创建性能测试数据
create_performance_test_data() {
    log_info "创建性能测试数据..."
    
    cat > test-data/performance/load-test-config.json << 'EOF'
{
  "loadTest": {
    "baseUrl": "http://localhost:3001",
    "scenarios": [
      {
        "name": "用户登录",
        "endpoint": "/api/auth/login",
        "method": "POST",
        "payload": {
          "email": "zhang.wei@test.com",
          "password": "TestPassword123!"
        },
        "expectedResponseTime": 500,
        "concurrentUsers": 50,
        "duration": "2m"
      },
      {
        "name": "获取项目列表",
        "endpoint": "/api/projects",
        "method": "GET",
        "requiresAuth": true,
        "expectedResponseTime": 300,
        "concurrentUsers": 100,
        "duration": "3m"
      },
      {
        "name": "获取故事列表",
        "endpoint": "/api/stories",
        "method": "GET", 
        "requiresAuth": true,
        "expectedResponseTime": 400,
        "concurrentUsers": 80,
        "duration": "3m"
      },
      {
        "name": "获取下一个提示",
        "endpoint": "/api/prompts/next/project-001",
        "method": "GET",
        "requiresAuth": true,
        "expectedResponseTime": 200,
        "concurrentUsers": 60,
        "duration": "2m"
      }
    ],
    "thresholds": {
      "responseTime95": 1000,
      "responseTime99": 2000,
      "errorRate": 0.01,
      "throughput": 100
    }
  }
}
EOF
    
    log_success "性能测试数据创建完成"
}

# 创建测试报告模板
create_test_report_template() {
    log_info "创建测试报告模板..."
    
    cat > test-data/reports/test-report-template.md << 'EOF'
# Saga家族传记系统 - 测试报告

## 测试概览

**测试日期**: {TEST_DATE}
**测试人员**: {TESTER_NAME}
**测试环境**: {TEST_ENVIRONMENT}
**测试版本**: {VERSION}

## 测试范围

### 已测试的功能模块
- [ ] 任务1: 资源钱包系统
- [ ] 任务2: 身份验证和用户管理
- [ ] 任务3: AI提示系统
- [ ] 任务4: 录音和STT管道
- [ ] 任务5: 故事管理系统
- [ ] 任务6: 数据导出系统
- [ ] 任务7: Web仪表板
- [ ] 任务8: 移动应用基础

## 测试结果汇总

### 功能测试
- **通过**: {PASSED_TESTS}
- **失败**: {FAILED_TESTS}
- **跳过**: {SKIPPED_TESTS}
- **总计**: {TOTAL_TESTS}

### 性能测试
- **平均响应时间**: {AVG_RESPONSE_TIME}ms
- **95%响应时间**: {P95_RESPONSE_TIME}ms
- **错误率**: {ERROR_RATE}%
- **吞吐量**: {THROUGHPUT} req/s

### 安全测试
- **SQL注入**: {SQL_INJECTION_RESULT}
- **XSS防护**: {XSS_PROTECTION_RESULT}
- **CSRF保护**: {CSRF_PROTECTION_RESULT}
- **认证绕过**: {AUTH_BYPASS_RESULT}

## 详细测试结果

### 任务1: 资源钱包系统
**状态**: {TASK1_STATUS}
**测试用例**: {TASK1_TEST_CASES}
**通过率**: {TASK1_PASS_RATE}%

**主要发现**:
- {TASK1_FINDING_1}
- {TASK1_FINDING_2}

### 任务2: 身份验证和用户管理
**状态**: {TASK2_STATUS}
**测试用例**: {TASK2_TEST_CASES}
**通过率**: {TASK2_PASS_RATE}%

**主要发现**:
- {TASK2_FINDING_1}
- {TASK2_FINDING_2}

### 任务3: AI提示系统
**状态**: {TASK3_STATUS}
**测试用例**: {TASK3_TEST_CASES}
**通过率**: {TASK3_PASS_RATE}%

**主要发现**:
- {TASK3_FINDING_1}
- {TASK3_FINDING_2}

### 任务4: 录音和STT管道
**状态**: {TASK4_STATUS}
**测试用例**: {TASK4_TEST_CASES}
**通过率**: {TASK4_PASS_RATE}%

**主要发现**:
- {TASK4_FINDING_1}
- {TASK4_FINDING_2}

### 任务5: 故事管理系统
**状态**: {TASK5_STATUS}
**测试用例**: {TASK5_TEST_CASES}
**通过率**: {TASK5_PASS_RATE}%

**主要发现**:
- {TASK5_FINDING_1}
- {TASK5_FINDING_2}

### 任务6: 数据导出系统
**状态**: {TASK6_STATUS}
**测试用例**: {TASK6_TEST_CASES}
**通过率**: {TASK6_PASS_RATE}%

**主要发现**:
- {TASK6_FINDING_1}
- {TASK6_FINDING_2}

### 任务7: Web仪表板
**状态**: {TASK7_STATUS}
**测试用例**: {TASK7_TEST_CASES}
**通过率**: {TASK7_PASS_RATE}%

**主要发现**:
- {TASK7_FINDING_1}
- {TASK7_FINDING_2}

### 任务8: 移动应用基础
**状态**: {TASK8_STATUS}
**测试用例**: {TASK8_TEST_CASES}
**通过率**: {TASK8_PASS_RATE}%

**主要发现**:
- {TASK8_FINDING_1}
- {TASK8_FINDING_2}

## 发现的问题

### 高优先级问题
1. **问题标题**: {HIGH_ISSUE_1_TITLE}
   - **描述**: {HIGH_ISSUE_1_DESC}
   - **重现步骤**: {HIGH_ISSUE_1_STEPS}
   - **影响**: {HIGH_ISSUE_1_IMPACT}

### 中优先级问题
1. **问题标题**: {MEDIUM_ISSUE_1_TITLE}
   - **描述**: {MEDIUM_ISSUE_1_DESC}
   - **重现步骤**: {MEDIUM_ISSUE_1_STEPS}
   - **影响**: {MEDIUM_ISSUE_1_IMPACT}

### 低优先级问题
1. **问题标题**: {LOW_ISSUE_1_TITLE}
   - **描述**: {LOW_ISSUE_1_DESC}
   - **重现步骤**: {LOW_ISSUE_1_STEPS}
   - **影响**: {LOW_ISSUE_1_IMPACT}

## 建议和改进

### 功能改进建议
- {FUNCTIONAL_IMPROVEMENT_1}
- {FUNCTIONAL_IMPROVEMENT_2}

### 性能优化建议
- {PERFORMANCE_IMPROVEMENT_1}
- {PERFORMANCE_IMPROVEMENT_2}

### 用户体验改进
- {UX_IMPROVEMENT_1}
- {UX_IMPROVEMENT_2}

## 测试环境信息

### 硬件配置
- **CPU**: {CPU_INFO}
- **内存**: {MEMORY_INFO}
- **存储**: {STORAGE_INFO}

### 软件环境
- **操作系统**: {OS_INFO}
- **Node.js版本**: {NODE_VERSION}
- **数据库**: {DATABASE_INFO}
- **浏览器**: {BROWSER_INFO}

## 测试数据统计

### 测试覆盖率
- **代码覆盖率**: {CODE_COVERAGE}%
- **功能覆盖率**: {FUNCTIONAL_COVERAGE}%
- **API覆盖率**: {API_COVERAGE}%

### 测试执行时间
- **单元测试**: {UNIT_TEST_TIME}
- **集成测试**: {INTEGRATION_TEST_TIME}
- **端到端测试**: {E2E_TEST_TIME}
- **总计**: {TOTAL_TEST_TIME}

## 结论

### 系统就绪状态
**整体评估**: {OVERALL_ASSESSMENT}

**生产就绪度**: {PRODUCTION_READINESS}

**推荐行动**:
- {RECOMMENDATION_1}
- {RECOMMENDATION_2}
- {RECOMMENDATION_3}

### 下一步计划
1. {NEXT_STEP_1}
2. {NEXT_STEP_2}
3. {NEXT_STEP_3}

---

**报告生成时间**: {REPORT_GENERATION_TIME}
**报告版本**: {REPORT_VERSION}
EOF
    
    log_success "测试报告模板创建完成"
}

# 主函数
main() {
    echo "开始创建测试数据..."
    echo "这将为Saga家族传记系统生成完整的测试数据集"
    echo ""
    
    create_test_directories
    generate_test_users
    generate_test_projects
    generate_test_stories
    generate_test_prompts
    create_test_audio_files
    create_test_images
    create_database_seeds
    create_api_test_script
    create_performance_test_data
    create_test_report_template
    
    echo ""
    echo "=============================================================="
    echo "🎉 测试数据创建完成！"
    echo "=============================================================="
    echo ""
    echo "创建的内容："
    echo "📁 test-data/ - 测试数据目录"
    echo "   ├── users/ - 测试用户数据"
    echo "   ├── projects/ - 测试项目数据"
    echo "   ├── stories/ - 测试故事数据"
    echo "   ├── prompts/ - 测试提示数据"
    echo "   ├── audio/ - 测试音频文件"
    echo "   ├── images/ - 测试图片文件"
    echo "   ├── performance/ - 性能测试配置"
    echo "   └── reports/ - 测试报告模板"
    echo ""
    echo "📄 packages/backend/seeds/99_test_data.js - 数据库种子文件"
    echo "🔧 scripts/test-api-endpoints.sh - API测试脚本"
    echo ""
    echo "下一步："
    echo "1. 运行数据库种子: cd packages/backend && npm run seed:run"
    echo "2. 启动服务器: npm run dev"
    echo "3. 运行API测试: ./scripts/test-api-endpoints.sh"
    echo "4. 开始人工测试: 参考 MANUAL_TESTING_GUIDE.md"
    echo ""
    log_success "准备就绪！🚀"
}

# 运行主函数
main "$@"