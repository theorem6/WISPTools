/**
 * APT Repository Management Service
 * Handles creation and management of tenant-specific APT repositories for EPC updates
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class APTRepositoryService {
  constructor() {
    this.repositoryRoot = process.env.APT_REPOSITORY_ROOT || '/var/www/apt-repos';
    this.gpgKeyDir = process.env.GPG_KEY_DIR || '/opt/apt-keys';
    this.packageBuildDir = process.env.PACKAGE_BUILD_DIR || '/tmp/package-builds';
  }

  /**
   * Initialize APT repository infrastructure
   */
  async initialize() {
    try {
      // Create necessary directories
      await fs.mkdir(this.repositoryRoot, { recursive: true });
      await fs.mkdir(this.gpgKeyDir, { recursive: true });
      await fs.mkdir(this.packageBuildDir, { recursive: true });

      console.log('[APT Repository] Infrastructure initialized');
      return { success: true };
    } catch (error) {
      console.error('[APT Repository] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create tenant-specific APT repository
   */
  async createTenantRepository(tenantId, tenantName) {
    try {
      const repoPath = path.join(this.repositoryRoot, tenantId);
      
      // Create repository directory structure
      await fs.mkdir(repoPath, { recursive: true });
      await fs.mkdir(path.join(repoPath, 'dists'), { recursive: true });
      await fs.mkdir(path.join(repoPath, 'pool'), { recursive: true });
      await fs.mkdir(path.join(repoPath, 'pool/main'), { recursive: true });

      // Generate GPG key for repository signing
      const gpgKey = await this.generateGPGKey(tenantId, tenantName);

      // Create repository configuration
      const repoConfig = {
        tenantId,
        tenantName,
        repositoryPath: repoPath,
        gpgKeyId: gpgKey.keyId,
        gpgKeyFingerprint: gpgKey.fingerprint,
        createdAt: new Date().toISOString(),
        packages: []
      };

      // Save repository configuration
      await fs.writeFile(
        path.join(repoPath, 'repository.json'),
        JSON.stringify(repoConfig, null, 2)
      );

      console.log(`[APT Repository] Created repository for tenant: ${tenantId}`);
      return repoConfig;
    } catch (error) {
      console.error(`[APT Repository] Failed to create repository for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Generate GPG key for repository signing
   */
  async generateGPGKey(tenantId, tenantName) {
    try {
      const keyId = `wisptools-${tenantId}`;
      const keyConfig = `
Key-Type: RSA
Key-Length: 4096
Subkey-Type: RSA
Subkey-Length: 4096
Name-Real: WispTools APT Repository
Name-Email: apt-${tenantId}@wisptools.io
Name-Comment: ${tenantName} APT Repository Key
Expire-Date: 2y
Passphrase: ${crypto.randomBytes(32).toString('hex')}
%commit
%echo done
`;

      const configPath = path.join(this.gpgKeyDir, `${keyId}.conf`);
      await fs.writeFile(configPath, keyConfig);

      // Generate key
      await execAsync(`gpg --batch --generate-key ${configPath}`);

      // Export public key
      const { stdout: publicKey } = await execAsync(`gpg --armor --export apt-${tenantId}@wisptools.io`);
      
      // Get key fingerprint
      const { stdout: fingerprint } = await execAsync(`gpg --fingerprint apt-${tenantId}@wisptools.io | grep -E "^[[:space:]]*[0-9A-F]{4}" | tr -d ' '`);

      // Save keys
      await fs.writeFile(path.join(this.gpgKeyDir, `${keyId}.pub`), publicKey);

      return {
        keyId,
        fingerprint: fingerprint.trim(),
        publicKey
      };
    } catch (error) {
      console.error(`[APT Repository] GPG key generation failed for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Add package to repository
   */
  async addPackage(tenantId, packageFile, packageInfo) {
    try {
      const repoPath = path.join(this.repositoryRoot, tenantId);
      const poolPath = path.join(repoPath, 'pool/main');

      // Copy package to pool
      const packageName = path.basename(packageFile);
      const targetPath = path.join(poolPath, packageName);
      await fs.copyFile(packageFile, targetPath);

      // Update repository metadata
      await this.updateRepositoryMetadata(tenantId);

      console.log(`[APT Repository] Added package ${packageName} to repository ${tenantId}`);
      return { success: true, packagePath: targetPath };
    } catch (error) {
      console.error(`[APT Repository] Failed to add package to ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Update repository metadata (Packages, Release files)
   */
  async updateRepositoryMetadata(tenantId) {
    try {
      const repoPath = path.join(this.repositoryRoot, tenantId);
      const distsPath = path.join(repoPath, 'dists/stable');
      const mainPath = path.join(distsPath, 'main/binary-amd64');

      // Create directory structure
      await fs.mkdir(mainPath, { recursive: true });

      // Generate Packages file
      const poolPath = path.join(repoPath, 'pool/main');
      await execAsync(`cd ${poolPath} && dpkg-scanpackages . /dev/null > ${mainPath}/Packages`);
      await execAsync(`gzip -c ${mainPath}/Packages > ${mainPath}/Packages.gz`);

      // Generate Release file
      const releaseContent = `
Archive: stable
Component: main
Origin: WispTools
Label: WispTools APT Repository
Architecture: amd64
Date: ${new Date().toUTCString()}
`;

      await fs.writeFile(path.join(distsPath, 'Release'), releaseContent.trim());

      // Sign Release file
      const keyEmail = `apt-${tenantId}@wisptools.io`;
      await execAsync(`cd ${distsPath} && gpg --armor --detach-sign --local-user ${keyEmail} Release`);

      console.log(`[APT Repository] Updated metadata for repository ${tenantId}`);
      return { success: true };
    } catch (error) {
      console.error(`[APT Repository] Failed to update metadata for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Get repository configuration for tenant
   */
  async getRepositoryConfig(tenantId) {
    try {
      const configPath = path.join(this.repositoryRoot, tenantId, 'repository.json');
      const configData = await fs.readFile(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.error(`[APT Repository] Failed to get config for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Generate APT sources.list entry for tenant
   */
  generateSourcesListEntry(tenantId, serverUrl) {
    return `deb ${serverUrl}/apt-repos/${tenantId} stable main`;
  }

  /**
   * Get public GPG key for tenant repository
   */
  async getPublicKey(tenantId) {
    try {
      const keyPath = path.join(this.gpgKeyDir, `wisptools-${tenantId}.pub`);
      return await fs.readFile(keyPath, 'utf8');
    } catch (error) {
      console.error(`[APT Repository] Failed to get public key for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * List packages in repository
   */
  async listPackages(tenantId) {
    try {
      const poolPath = path.join(this.repositoryRoot, tenantId, 'pool/main');
      const files = await fs.readdir(poolPath);
      const packages = files.filter(file => file.endsWith('.deb'));

      const packageInfo = [];
      for (const pkg of packages) {
        const { stdout } = await execAsync(`dpkg-deb -I ${path.join(poolPath, pkg)}`);
        packageInfo.push({
          filename: pkg,
          info: stdout
        });
      }

      return packageInfo;
    } catch (error) {
      console.error(`[APT Repository] Failed to list packages for ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Remove package from repository
   */
  async removePackage(tenantId, packageName) {
    try {
      const packagePath = path.join(this.repositoryRoot, tenantId, 'pool/main', packageName);
      await fs.unlink(packagePath);
      await this.updateRepositoryMetadata(tenantId);

      console.log(`[APT Repository] Removed package ${packageName} from ${tenantId}`);
      return { success: true };
    } catch (error) {
      console.error(`[APT Repository] Failed to remove package ${packageName} from ${tenantId}:`, error);
      throw error;
    }
  }
}

module.exports = new APTRepositoryService();
