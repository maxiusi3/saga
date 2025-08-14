/**
 * Comprehensive Test Suite Runner
 * 
 * This file orchestrates the execution of all test categories for Task 8.1
 * It ensures proper test organization and coverage reporting.
 */

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

interface TestSuite {
  name: string;
  pattern: string;
  timeout: number;
  description: string;
}

const testSuites: TestSuite[] = [
  {
    name: 'Unit Tests',
    pattern: 'src/**/*.test.ts --testPathIgnorePatterns=integration',
    timeout: 10000,
    description: 'Individual component and service tests'
  },
  {
    name: 'Integration Tests',
    pattern: 'src/tests/integration/**/*.test.ts',
    timeout: 60000,
    description: 'Cross-component workflow tests'
  },
  {
    name: 'Security Tests',
    pattern: 'src/tests/security.test.ts',
    timeout: 30000,
    description: 'Security vulnerability and access control tests'
  },
  {
    name: 'Performance Tests',
    pattern: 'src/tests/performance/**/*.test.ts',
    timeout: 120000,
    description: 'Load and performance validation tests'
  }
];

export class ComprehensiveTestRunner {
  private results: Map<string, any> = new Map();
  
  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Comprehensive Test Suite for Task 8.1');
    console.log('=' .repeat(60));
    
    for (const suite of testSuites) {
      await this.runTestSuite(suite);
    }
    
    await this.generateCoverageReport();
    await this.generateTestReport();
  }
  
  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`\n📋 Running ${suite.name}...`);
    console.log(`   ${suite.description}`);
    console.log(`   Pattern: ${suite.pattern}`);
    
    try {
      const startTime = Date.now();
      
      // Run the test suite
      const result = execSync(
        `npx jest ${suite.pattern} --testTimeout=${suite.timeout} --verbose`,
        { 
          cwd: path.resolve(__dirname, '../..'),
          encoding: 'utf8',
          stdio: 'pipe'
        }
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      this.results.set(suite.name, {
        success: true,
        duration,
        output: result
      });
      
      console.log(`✅ ${suite.name} completed in ${duration}ms`);
      
    } catch (error: any) {
      console.log(`❌ ${suite.name} failed:`);
      console.log(error.stdout || error.message);
      
      this.results.set(suite.name, {
        success: false,
        error: error.message,
        output: error.stdout
      });
    }
  }
  
  private async generateCoverageReport(): Promise<void> {
    console.log('\n📊 Generating Coverage Report...');
    
    try {
      const coverageResult = execSync(
        'npx jest --coverage --coverageReporters=text --coverageReporters=json-summary',
        { 
          cwd: path.resolve(__dirname, '../..'),
          encoding: 'utf8',
          stdio: 'pipe'
        }
      );
      
      console.log('✅ Coverage report generated');
      
      // Read coverage summary
      const coveragePath = path.resolve(__dirname, '../../coverage/coverage-summary.json');
      if (fs.existsSync(coveragePath)) {
        const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
        this.logCoverageSummary(coverage);
      }
      
    } catch (error: any) {
      console.log('❌ Coverage report generation failed:', error.message);
    }
  }
  
  private logCoverageSummary(coverage: any): void {
    console.log('\n📈 Coverage Summary:');
    console.log('=' .repeat(40));
    
    const total = coverage.total;
    console.log(`Lines:      ${total.lines.pct}% (${total.lines.covered}/${total.lines.total})`);
    console.log(`Functions:  ${total.functions.pct}% (${total.functions.covered}/${total.functions.total})`);
    console.log(`Branches:   ${total.branches.pct}% (${total.branches.covered}/${total.branches.total})`);
    console.log(`Statements: ${total.statements.pct}% (${total.statements.covered}/${total.statements.total})`);
    
    // Check if we meet the 80% threshold
    const meetsThreshold = [
      total.lines.pct >= 80,
      total.functions.pct >= 80,
      total.branches.pct >= 80,
      total.statements.pct >= 80
    ].every(Boolean);
    
    if (meetsThreshold) {
      console.log('✅ Coverage meets 80% threshold requirement');
    } else {
      console.log('❌ Coverage does not meet 80% threshold requirement');
    }
  }
  
  private async generateTestReport(): Promise<void> {
    console.log('\n📋 Test Execution Summary:');
    console.log('=' .repeat(60));
    
    let totalPassed = 0;
    let totalFailed = 0;
    
    for (const [suiteName, result] of this.results) {
      const status = result.success ? '✅ PASSED' : '❌ FAILED';
      const duration = result.duration ? `(${result.duration}ms)` : '';
      
      console.log(`${status} ${suiteName} ${duration}`);
      
      if (result.success) {
        totalPassed++;
      } else {
        totalFailed++;
        console.log(`   Error: ${result.error}`);
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log(`Total Suites: ${totalPassed + totalFailed}`);
    console.log(`Passed: ${totalPassed}`);
    console.log(`Failed: ${totalFailed}`);
    
    if (totalFailed === 0) {
      console.log('🎉 All test suites passed successfully!');
    } else {
      console.log(`⚠️  ${totalFailed} test suite(s) failed`);
    }
  }
}

// Export for use in other test files
export default ComprehensiveTestRunner;

// Run if called directly
if (require.main === module) {
  const runner = new ComprehensiveTestRunner();
  runner.runAllTests().catch(console.error);
}