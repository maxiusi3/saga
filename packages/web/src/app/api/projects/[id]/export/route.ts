import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import JSZip from 'jszip'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { id: projectId } = params

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 验证用户是否是项目所有者或有权限访问项目
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        *,
        project_roles!inner(user_id, role)
      `)
      .eq('id', projectId)
      .or(`owner_id.eq.${user.id},project_roles.user_id.eq.${user.id}`)
      .single()

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      )
    }

    // 获取项目的所有故事
    const { data: stories, error: storiesError } = await supabase
      .from('stories')
      .select(`
        *,
        story_interactions (
          *,
          user:user_id (
            email,
            user_metadata
          )
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (storiesError) {
      console.error('Error fetching stories:', storiesError)
      return NextResponse.json(
        { error: 'Failed to fetch project stories' },
        { status: 500 }
      )
    }

    // 获取项目成员信息
    const { data: members, error: membersError } = await supabase
      .from('project_roles')
      .select(`
        *,
        user:user_id (
          email,
          user_metadata
        )
      `)
      .eq('project_id', projectId)

    if (membersError) {
      console.error('Error fetching members:', membersError)
    }

    // 创建ZIP文件
    const zip = new JSZip()

    // 添加项目信息文件
    const projectInfo = {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        created_at: project.created_at,
        updated_at: project.updated_at,
        owner_id: project.owner_id
      },
      members: members || [],
      export_date: new Date().toISOString(),
      export_version: '1.0'
    }

    zip.file('project-info.json', JSON.stringify(projectInfo, null, 2))

    // 添加故事数据
    const storiesData = {
      stories: stories || [],
      total_count: stories?.length || 0
    }

    zip.file('stories.json', JSON.stringify(storiesData, null, 2))

    // 为每个故事创建单独的文件夹
    if (stories && stories.length > 0) {
      const storiesFolder = zip.folder('stories')
      
      for (const story of stories) {
        const storyFolder = storiesFolder?.folder(`story-${story.id}`)
        
        // 故事基本信息
        const storyInfo = {
          id: story.id,
          title: story.title,
          transcript: story.transcript,
          summary: story.summary,
          duration: story.duration,
          created_at: story.created_at,
          updated_at: story.updated_at,
          user_id: story.user_id,
          interactions: story.story_interactions || []
        }

        storyFolder?.file('story-info.json', JSON.stringify(storyInfo, null, 2))

        // 如果有转录文本，创建单独的文本文件
        if (story.transcript) {
          storyFolder?.file('transcript.txt', story.transcript)
        }

        // 如果有摘要，创建单独的摘要文件
        if (story.summary) {
          storyFolder?.file('summary.txt', story.summary)
        }

        // 创建互动记录文件
        if (story.story_interactions && story.story_interactions.length > 0) {
          const interactionsData = {
            interactions: story.story_interactions,
            total_count: story.story_interactions.length
          }
          storyFolder?.file('interactions.json', JSON.stringify(interactionsData, null, 2))
        }
      }
    }

    // 添加README文件
    const readmeContent = `# ${project.name} - Data Export

This archive contains all data from your Saga project "${project.name}".

## Contents

- **project-info.json**: Basic project information and member list
- **stories.json**: Complete list of all stories with metadata
- **stories/**: Individual folders for each story containing:
  - story-info.json: Complete story data including interactions
  - transcript.txt: Story transcript (if available)
  - summary.txt: Story summary (if available)
  - interactions.json: Comments and follow-up questions

## Export Information

- Export Date: ${new Date().toISOString()}
- Export Version: 1.0
- Total Stories: ${stories?.length || 0}
- Project Created: ${project.created_at}

## Data Format

All data is exported in JSON format for easy parsing and import into other systems.
Text files are provided in UTF-8 encoding.

## Privacy Notice

This export contains personal stories and information. Please handle with care
and in accordance with your family's privacy preferences.

---
Generated by Saga - AI Family Biography Platform
`

    zip.file('README.md', readmeContent)

    // 生成ZIP文件
    const zipBuffer = await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })

    // 生成文件名
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `${project.name.replace(/[^a-zA-Z0-9]/g, '_')}_export_${timestamp}.zip`

    // 返回ZIP文件
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    })

  } catch (error) {
    console.error('Error in POST /api/projects/[id]/export:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
