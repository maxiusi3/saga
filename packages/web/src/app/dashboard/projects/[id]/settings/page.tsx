'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: 'facilitator' | 'storyteller';
  status: 'active' | 'invited' | 'expired';
  avatar?: string;
  joinedAt?: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
}

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    if (params.id) {
      loadProjectSettings(params.id as string);
    }
  }, [params.id]);

  const loadProjectSettings = async (projectId: string) => {
    try {
      setLoading(true);
      
      // Load project details
      const projectResponse = await api.projects.get(projectId);
      setProject(projectResponse.data);
      
      // TODO: Load project members when API is available
      // const membersResponse = await api.projects.members(projectId);
      // setMembers(membersResponse.data || []);
      
      // For now, set empty members array
      setMembers([]);
    } catch (error) {
      console.error('Failed to load project settings:', error);
    } finally {
      setLoading(false);
    }
  };



  const handleSaveProject = async () => {
    setSaving(true);
    try {
      // TODO: Save project details to API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (project) {
        setProject({
          ...project,
          name: projectName,
          description: projectDescription
        });
      }
    } catch (error) {
      console.error('Failed to save project:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (window.confirm('Are you sure you want to remove this member?')) {
      // TODO: Remove member via API
      setMembers(members.filter(m => m.id !== memberId));
    }
  };

  const handleInviteFacilitator = () => {
    // TODO: Check for available facilitator seats
    router.push(`/dashboard/projects/${params.id}/invite/facilitator`);
  };

  const handleInviteStoryteller = () => {
    // TODO: Check for available storyteller seats
    router.push(`/dashboard/projects/${params.id}/invite/storyteller`);
  };

  const handleExportProject = () => {
    router.push(`/dashboard/projects/${params.id}/export`);
  };

  const handleDeleteProject = async () => {
    if (deleteConfirmText !== project?.name) {
      alert('Please type the project name exactly to confirm deletion.');
      return;
    }

    try {
      // TODO: Delete project via API
      await new Promise(resolve => setTimeout(resolve, 1000));
      router.push('/dashboard/projects');
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'facilitator':
        return 'bg-blue-100 text-blue-800';
      case 'storyteller':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'invited':
        return 'bg-yellow-100 text-yellow-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
            className="mr-4"
          >
            ← Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Project Settings</h1>
        </div>
        <p className="text-gray-600">
          Manage project details, members, and settings
        </p>
      </div>

      <div className="space-y-8">
        {/* Project Details */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Details</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter project name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe this project..."
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSaveProject}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Members Section */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Members</h2>
            <div className="flex space-x-2">
              <Button
                onClick={handleInviteFacilitator}
                variant="outline"
                size="sm"
              >
                Invite Co-Facilitator
              </Button>
              {!members.some(m => m.role === 'storyteller' && m.status === 'active') && (
                <Button
                  onClick={handleInviteStoryteller}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Invite Storyteller
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center mr-4">
                    <span className="text-sm font-medium text-gray-600">
                      {member.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-medium text-gray-900">{member.name}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                        {member.role}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(member.status)}`}>
                        {member.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{member.email}</p>
                    {member.joinedAt && (
                      <p className="text-xs text-gray-500">
                        Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                
                {member.role === 'facilitator' && (
                  <Button
                    onClick={() => handleRemoveMember(member.id)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:border-red-300"
                  >
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Data Section */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Management</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900">Export Full Archive</h3>
                <p className="text-sm text-gray-600">
                  Download all stories, transcripts, and photos as a complete archive
                </p>
              </div>
              <Button
                onClick={handleExportProject}
                variant="outline"
              >
                Export Project
              </Button>
            </div>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card className="p-6 border-red-200">
          <h2 className="text-xl font-semibold text-red-900 mb-4">Danger Zone</h2>
          
          <div className="bg-red-50 rounded-lg p-4">
            <h3 className="font-medium text-red-900 mb-2">Delete Project</h3>
            <p className="text-sm text-red-700 mb-4">
              This action cannot be undone. This will permanently delete the project and all associated stories, transcripts, and data.
            </p>
            
            {!showDeleteConfirm ? (
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete Project
              </Button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-red-700 mb-2">
                    Type the project name "{project?.name}" to confirm:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder={project?.name}
                  />
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={handleDeleteProject}
                    disabled={deleteConfirmText !== project?.name}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    I understand, delete this project
                  </Button>
                  <Button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}