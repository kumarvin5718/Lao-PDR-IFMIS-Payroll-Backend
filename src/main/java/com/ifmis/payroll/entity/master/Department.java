package com.ifmis.payroll.entity.master;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "department")
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class Department {
    @Id
    @Column(name = "dept_key", unique = true, nullable = false, updatable = false)
    private String ministryKey;

    @Column(name = "name", nullable = false, unique = true)
    private String name;
}
