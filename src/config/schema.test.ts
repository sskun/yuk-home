import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateConfig, isCssColor, ConfigError, type SiteConfig } from './schema';

// 构造一份合法的基线配置，测试中按需覆写字段以制造非法场景
function makeValidConfig(): SiteConfig {
  return {
    site: { title: '标题', description: '描述', lang: 'zh-CN' },
    theme: {
      primaryColor: '#7c3aed',
      accentColor: '#22d3ee',
      animationEnabled: true,
      animationBaseDelay: 120,
    },
    sections: [
      {
        id: 'hero',
        type: 'hero',
        headline: '主标题',
        subheadline: '副标题',
        ctas: [{ label: '了解', href: '#a', variant: 'primary' }],
      },
      {
        id: 'features',
        type: 'feature',
        heading: '特性',
        features: [{ title: '快', description: '很快' }],
      },
      { id: 'footer', type: 'footer', copyright: '© 2026', links: [] },
    ],
  };
}

describe('validateConfig - 合法输入', () => {
  it('合法配置应通过并原样返回', () => {
    const cfg = makeValidConfig();
    expect(validateConfig(cfg)).toBe(cfg);
  });

  it('不应修改输入对象（无副作用）', () => {
    const cfg = makeValidConfig();
    const snapshot = JSON.stringify(cfg);
    validateConfig(cfg);
    expect(JSON.stringify(cfg)).toBe(snapshot);
  });
});

describe('validateConfig - 非法输入', () => {
  it('非对象输入抛 ConfigError', () => {
    expect(() => validateConfig(null)).toThrow(ConfigError);
    expect(() => validateConfig('x')).toThrow(ConfigError);
  });

  it('空标题应报错且信息含字段路径', () => {
    const cfg = makeValidConfig();
    cfg.site.title = '';
    expect(() => validateConfig(cfg)).toThrow(/site\.title/);
  });

  it('非法颜色应报错并含字段路径', () => {
    const cfg = makeValidConfig();
    cfg.theme.primaryColor = 'not-a-color-#';
    expect(() => validateConfig(cfg)).toThrow(/theme\.primaryColor/);
  });

  it('空 sections 应报错', () => {
    const cfg = makeValidConfig();
    cfg.sections = [];
    expect(() => validateConfig(cfg)).toThrow(/sections/);
  });

  it('重复 id 应报错并含 id 值', () => {
    const cfg = makeValidConfig();
    cfg.sections[1].id = 'hero'; // 与第一个冲突
    expect(() => validateConfig(cfg)).toThrow(/重复的 id "hero"/);
  });

  it('未知区块类型应报错', () => {
    const cfg = makeValidConfig();
    // @ts-expect-error 故意注入非法类型
    cfg.sections[0].type = 'banner';
    expect(() => validateConfig(cfg)).toThrow(/未知的区块类型 "banner"/);
  });

  it('应一次性汇总多个错误', () => {
    const cfg = makeValidConfig();
    cfg.site.title = '';
    cfg.site.description = '';
    try {
      validateConfig(cfg);
      throw new Error('should not reach');
    } catch (e) {
      const msg = (e as ConfigError).message;
      expect(msg).toContain('site.title');
      expect(msg).toContain('site.description');
    }
  });
});

describe('isCssColor', () => {
  it.each(['#fff', '#ffffff', '#ffffff80', 'rgb(0,0,0)', 'rgba(0,0,0,0.5)', 'red', 'rebeccapurple'])(
    '合法颜色 %s',
    (c) => expect(isCssColor(c)).toBe(true),
  );

  it.each(['', '   ', '#12', '123456', 'not a color', 42, null])(
    '非法颜色 %s',
    (c) => expect(isCssColor(c as unknown)).toBe(false),
  );
});

describe('属性测试：校验健全性（对应正确性属性 3）', () => {
  it('随机破坏必填字段后，validateConfig 必抛错', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'title' | 'description' | 'primaryColor'>('title', 'description', 'primaryColor'),
        (field) => {
          const cfg = makeValidConfig();
          // 用确定非法的值破坏字段：空字符串 / 过短的十六进制颜色
          if (field === 'title') cfg.site.title = '';
          else if (field === 'description') cfg.site.description = '';
          else cfg.theme.primaryColor = '#12'; // 长度非法的 hex，isCssColor 必判 false
          expect(() => validateConfig(cfg)).toThrow(ConfigError);
        },
      ),
    );
  });

  it('对任意非对象输入必抛 ConfigError', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
        (bad) => {
          expect(() => validateConfig(bad)).toThrow(ConfigError);
        },
      ),
    );
  });
});
