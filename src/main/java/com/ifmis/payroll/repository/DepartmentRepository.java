package com.ifmis.payroll.repository;


import com.ifmis.payroll.entity.master.Department;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface DepartmentRepository extends JpaRepository<Department, UUID> {
}